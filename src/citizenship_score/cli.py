"""
Command-line entry points for the Phase 0 scoring engine.

Commands:
    fetch     pull workouts from the live Lyfta API and save the raw JSON
    score     score previously saved raw workout JSON and print a breakdown
    sandbox   fetch from the sandbox endpoint and run the full pipeline on it
    simulate  generate synthetic daily histories and print class transitions,
              to sanity-check the promotion/demotion hysteresis
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig
from citizenship_score.lyfta_client import LyftaApiError, LyftaAuthError, LyftaClient
from citizenship_score.models import HabitCompletion, HabitDefinition, Workout
from citizenship_score.scoring.classes import classes_with_hysteresis, rolling_scores
from citizenship_score.scoring.habits import score_habit_completions
from citizenship_score.scoring.workouts import (
    apply_weekly_consistency,
    daily_workout_points,
    distinct_set_type_ids,
    scored_session_dates,
)

RAW_DATA_DIR = Path("data/raw")


# --------------------------------------------------------------------------
# Shared helpers
# --------------------------------------------------------------------------


def _parse_date(value: str) -> date:
    return date.fromisoformat(value)


def _save_raw_workouts(raw_workouts: list[dict], label: str) -> Path:
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = RAW_DATA_DIR / f"{label}_{timestamp}.json"
    path.write_text(json.dumps(raw_workouts, indent=2))
    return path


def _load_raw_workouts(path: Path) -> list[dict]:
    return json.loads(path.read_text())


def _latest_raw_file() -> Path:
    candidates = sorted(RAW_DATA_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
    if not candidates:
        raise SystemExit(
            f"No saved workout files found in {RAW_DATA_DIR}/. Run `fetch` or `sandbox` first, "
            "or pass --in explicitly."
        )
    return candidates[-1]


def _config_with_excludes(exclude_set_types: str | None) -> ScoringConfig:
    if not exclude_set_types:
        return DEFAULT_CONFIG
    ids = frozenset(s.strip() for s in exclude_set_types.split(",") if s.strip())
    return ScoringConfig(excluded_set_type_ids=ids)


def _load_habits(path: str | None) -> tuple[list[HabitDefinition], list[HabitCompletion]]:
    """Reads {"habits": [HabitDefinition...], "completions": [HabitCompletion...]}."""
    if not path:
        return [], []
    raw = json.loads(Path(path).read_text())
    habits = [HabitDefinition.model_validate(item) for item in raw.get("habits", [])]
    completions = [HabitCompletion.model_validate(item) for item in raw.get("completions", [])]
    return habits, completions


def _print_breakdown_and_scores(
    workouts: list[Workout],
    habits: tuple[list[HabitDefinition], list[HabitCompletion]],
    config: ScoringConfig,
    as_of: date | None,
) -> None:
    habit_definitions, habit_completions = habits
    print(f"\nDistinct set_type_ids found: {sorted(distinct_set_type_ids(workouts))}")
    if not config.excluded_set_type_ids:
        print(
            "  (none excluded yet -- once you know which id(s) mean 'warm-up', "
            "pass --exclude-set-types or update config.EXCLUDED_SET_TYPE_IDS)"
        )

    daily = daily_workout_points(workouts, config)
    final_workout_points = apply_weekly_consistency(daily, config)
    habit_points = score_habit_completions(
        habit_completions, habit_definitions, scored_session_dates(workouts, config), config, as_of=as_of
    )

    print("\n=== Per-session breakdown ===")
    for day in sorted(daily.keys()):
        dp = daily[day]
        print(f"\n{day} ({dp.session_count} session(s)):")
        for session in dp.breakdown:
            print(
                f"  workout {session['workout_id']!r} ({session['title']}): "
                f"{session['scored_sets']} scored set(s), "
                f"set_loads={[round(v, 2) for v in session['set_loads']]}, "
                f"raw_points={session['raw_session_points']:.2f}, "
                f"same_day_factor={session['same_day_factor']}, "
                f"session_points={session['session_points']:.2f}, "
                f"bonus_points={session['bonus_points']:.2f}"
            )
        print(
            f"  day total (pre-weekly-multiplier): "
            f"{dp.session_points + dp.bonus_points:.2f}  |  "
            f"final (post-weekly-multiplier): {final_workout_points[day]:.2f}"
        )
        if day in habit_points:
            print(f"  habit points: {habit_points[day]:.2f}")

    print("\n=== Weekly totals ===")
    weeks: dict[tuple[int, int], list[date]] = {}
    for day in final_workout_points:
        iso_year, iso_week, _ = day.isocalendar()
        weeks.setdefault((iso_year, iso_week), []).append(day)
    for (iso_year, iso_week), days in sorted(weeks.items()):
        days.sort()
        sessions = sum(daily[d].session_count for d in days)
        met = sessions >= config.weekly_session_target
        total_final = sum(final_workout_points[d] for d in days)
        print(
            f"  ISO week {iso_year}-W{iso_week:02d} ({days[0]}..{days[-1]}): "
            f"{sessions} session(s), target met: {met}, total points: {total_final:.2f}"
        )

    combined: dict[date, float] = {}
    for d, pts in final_workout_points.items():
        combined[d] = combined.get(d, 0.0) + pts
    for d, pts in habit_points.items():
        combined[d] = combined.get(d, 0.0) + pts

    rolling = rolling_scores(combined, config)
    classes = classes_with_hysteresis(rolling, config)
    if not classes:
        print("\nNo data to compute a rolling score / class.")
        return

    target_day = as_of or classes[-1].date
    by_date = {c.date: c for c in classes}
    if target_day not in by_date:
        print(f"\nNo data for {target_day}; showing the latest available day instead.")
        target_day = classes[-1].date

    result = by_date[target_day]
    print(f"\n=== Rolling score / class as of {result.date} ===")
    print(f"  rolling score (last {config.rolling_window_days} days): {result.rolling_score:.2f}")
    print(f"  class: {result.class_name}")


# --------------------------------------------------------------------------
# Commands
# --------------------------------------------------------------------------


def cmd_fetch(args: argparse.Namespace) -> int:
    try:
        client = LyftaClient(sandbox=False)
    except LyftaAuthError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    try:
        raw = client.fetch_workouts(date_from=args.date_from, date_to=args.date_to)
    except LyftaApiError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()

    path = _save_raw_workouts(raw, "workouts")
    print(f"Fetched {len(raw)} workout(s). Saved raw JSON to {path}")
    return 0


def cmd_sandbox(args: argparse.Namespace) -> int:
    client = LyftaClient(sandbox=True)
    try:
        raw = client.fetch_workouts()
    except LyftaApiError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        client.close()

    path = _save_raw_workouts(raw, "sandbox")
    print(f"Fetched {len(raw)} sandbox workout(s). Saved raw JSON to {path}")

    workouts = [Workout.model_validate(w) for w in raw]
    config = _config_with_excludes(args.exclude_set_types)
    habits = _load_habits(args.habits)
    _print_breakdown_and_scores(workouts, habits, config, args.as_of)
    return 0


def cmd_score(args: argparse.Namespace) -> int:
    path = Path(args.input) if args.input else _latest_raw_file()
    raw = _load_raw_workouts(path)
    workouts = [Workout.model_validate(w) for w in raw]
    print(f"Loaded {len(workouts)} workout(s) from {path}")

    config = _config_with_excludes(args.exclude_set_types)
    habits = _load_habits(args.habits)
    _print_breakdown_and_scores(workouts, habits, config, args.as_of)
    return 0


SIM_START = date(2026, 1, 5)  # a Monday; fixed so output is reproducible
SIM_SESSION_WEEKDAYS = {0, 2, 4}  # Mon/Wed/Fri
# Median session + progress-bonus points across the 82 scored sessions in a
# real Lyfta account's history (Sep 2026). Hardcoded so simulate doesn't
# depend on a gitignored data file.
SIM_GYM_SESSION_POINTS = 161.1
SIM_HABITS = [  # 6 daily habits across 4 categories: exactly hits the 90/day cap
    ("read", "Mind"),
    ("bible", "Spirit"),
    ("make-bed", "Discipline"),
    ("no-phone-am", "Discipline"),
    ("eat-well", "Body"),
    ("sleep-8h", "Body"),
]
SIM_MANY_HABITS = SIM_HABITS + [  # 10 habits, to show the weekly bonus cap holding
    ("journal", "Mind"),
    ("pray", "Spirit"),
    ("tidy", "Discipline"),
    ("water", "Body"),
]
SIMULATE_SCENARIOS = ["consistent", "quits", "habits-only", "gym-only", "habits-and-gym", "many-habits"]


def _simulate_series(scenario: str, days: int, config: ScoringConfig) -> dict[date, float]:
    all_days = [SIM_START + timedelta(days=i) for i in range(days)]

    if scenario in ("consistent", "quits"):
        # Hysteresis check: flat 120 pts Mon/Wed/Fri; "quits" stops after 3 weeks.
        active_days = days if scenario == "consistent" else 21
        return {
            d: 120.0 if i < active_days and d.weekday() in SIM_SESSION_WEEKDAYS else 0.0
            for i, d in enumerate(all_days)
        }

    daily = {d: 0.0 for d in all_days}
    gym = scenario in ("gym-only", "habits-and-gym")
    gym_days = [d for d in all_days if gym and d.weekday() in SIM_SESSION_WEEKDAYS]
    for d in gym_days:
        # 3 sessions/week meets the default weekly target, so the multiplier applies.
        daily[d] += SIM_GYM_SESSION_POINTS * config.weekly_consistency_multiplier

    if scenario in ("habits-only", "habits-and-gym", "many-habits"):
        habit_list = SIM_MANY_HABITS if scenario == "many-habits" else SIM_HABITS
        habits = [HabitDefinition(habit_id=h, category=c, weekly_target=7) for h, c in habit_list]
        completions = [HabitCompletion(habit_id=h, completed_on=d) for d in all_days for h, _ in habit_list]
        for d, pts in score_habit_completions(completions, habits, gym_days, config, as_of=all_days[-1]).items():
            daily[d] += pts
    return daily


def cmd_simulate(args: argparse.Namespace) -> int:
    config = DEFAULT_CONFIG
    scenarios = SIMULATE_SCENARIOS if args.scenario == "all" else [args.scenario]

    for scenario in scenarios:
        print(f"\n=== Scenario: {scenario} ({args.days} simulated days) ===")
        daily = _simulate_series(scenario, args.days, config)
        rolling = rolling_scores(daily, config)
        classes = classes_with_hysteresis(rolling, config)

        prev_class = None
        for c in classes:
            if c.class_name != prev_class:
                arrow = f"{prev_class} -> {c.class_name}" if prev_class else c.class_name
                print(f"  {c.date}  rolling={c.rolling_score:7.1f}  class: {arrow}")
                prev_class = c.class_name

        print(f"  final: {classes[-1].date}  rolling={classes[-1].rolling_score:.1f}  class={classes[-1].class_name}")

    return 0


# --------------------------------------------------------------------------
# Argument parsing
# --------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="citizenship-score", description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_fetch = subparsers.add_parser("fetch", help="Pull workouts from the live Lyfta API")
    p_fetch.add_argument("--from", dest="date_from", type=_parse_date, default=None)
    p_fetch.add_argument("--to", dest="date_to", type=_parse_date, default=None)
    p_fetch.set_defaults(func=cmd_fetch)

    p_score = subparsers.add_parser("score", help="Score previously saved raw workout JSON")
    p_score.add_argument("--in", dest="input", default=None, help="Path to a saved raw JSON file")
    p_score.add_argument(
        "--habits", default=None, help='Path to a JSON file: {"habits": [...], "completions": [...]}'
    )
    p_score.add_argument("--exclude-set-types", default=None, help="Comma-separated warm-up set_type_ids")
    p_score.add_argument("--as-of", type=_parse_date, default=None)
    p_score.set_defaults(func=cmd_score)

    p_sandbox = subparsers.add_parser("sandbox", help="Run the full pipeline on sandbox data")
    p_sandbox.add_argument("--habits", default=None)
    p_sandbox.add_argument("--exclude-set-types", default=None)
    p_sandbox.add_argument("--as-of", type=_parse_date, default=None)
    p_sandbox.set_defaults(func=cmd_sandbox)

    p_simulate = subparsers.add_parser(
        "simulate", help="Generate synthetic daily histories to sanity-check hysteresis"
    )
    p_simulate.add_argument("--scenario", choices=[*SIMULATE_SCENARIOS, "all"], default="all")
    p_simulate.add_argument("--days", type=int, default=120)
    p_simulate.set_defaults(func=cmd_simulate)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
