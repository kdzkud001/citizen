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
from citizenship_score.models import HabitCompletion, Workout
from citizenship_score.scoring.classes import classes_with_hysteresis, rolling_scores
from citizenship_score.scoring.habits import score_habit_completions
from citizenship_score.scoring.workouts import (
    apply_weekly_consistency,
    daily_workout_points,
    distinct_set_type_ids,
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


def _load_habits(path: str | None) -> list[HabitCompletion]:
    if not path:
        return []
    raw = json.loads(Path(path).read_text())
    return [HabitCompletion.model_validate(item) for item in raw]


def _print_breakdown_and_scores(
    workouts: list[Workout],
    habit_completions: list[HabitCompletion],
    config: ScoringConfig,
    as_of: date | None,
) -> None:
    print(f"\nDistinct set_type_ids found: {sorted(distinct_set_type_ids(workouts))}")
    if not config.excluded_set_type_ids:
        print(
            "  (none excluded yet -- once you know which id(s) mean 'warm-up', "
            "pass --exclude-set-types or update config.EXCLUDED_SET_TYPE_IDS)"
        )

    daily = daily_workout_points(workouts, config)
    final_workout_points = apply_weekly_consistency(daily, config)
    habit_points = score_habit_completions(habit_completions, config)

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


def _simulate_series(
    scenario: str, days: int, config: ScoringConfig
) -> dict[date, float]:
    start = date(2026, 1, 1)  # fixed epoch so output is reproducible
    session_days = {0, 2, 4}  # Mon/Wed/Fri
    session_points = 120.0  # tuned to comfortably cross class bands within a rolling window

    active_days = days if scenario == "consistent" else 21  # "quits": active for 3 weeks only

    daily: dict[date, float] = {}
    for i in range(days):
        day = start + timedelta(days=i)
        if i < active_days and day.weekday() in session_days:
            daily[day] = session_points
        else:
            daily[day] = 0.0
    return daily


def cmd_simulate(args: argparse.Namespace) -> int:
    config = DEFAULT_CONFIG
    scenarios = ["consistent", "quits"] if args.scenario == "both" else [args.scenario]

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
    p_score.add_argument("--habits", default=None, help="Path to a JSON file of habit completions")
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
    p_simulate.add_argument(
        "--scenario", choices=["consistent", "quits", "both"], default="both"
    )
    p_simulate.add_argument("--days", type=int, default=120)
    p_simulate.set_defaults(func=cmd_simulate)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
