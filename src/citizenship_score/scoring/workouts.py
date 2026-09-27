"""
Workout scoring: set load -> session points -> progress bonus -> weekly
consistency multiplier -> per-day workout points.

Design notes (see README "Assumptions" for the full list):

- Functions here are pure: no network or file I/O, no hidden global state.
  Everything needed is passed in explicitly.
- The Lyfta API only gives a calendar date (`workout_perform_date`) for each
  workout, not a timestamp. When multiple workouts share a day, "first"
  vs. "additional" session is decided by each workout's position in the
  input list -- callers (the CLI, tests) are expected to pass workouts in
  the order they actually occurred. Sorting elsewhere in this module is
  stable, so this ordering is preserved wherever it matters.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig
from citizenship_score.models import Exercise, Set, Workout


# --------------------------------------------------------------------------
# Set-level scoring
# --------------------------------------------------------------------------


def effort_multiplier(rir: int | None, config: ScoringConfig = DEFAULT_CONFIG) -> float:
    """RIR (reps in reserve) -> effort multiplier E."""
    if rir is None:
        return config.rir_effort_default
    for lo, hi, multiplier in config.rir_effort_bands:
        if hi is None:
            if rir >= lo:
                return multiplier
        elif lo <= rir <= hi:
            return multiplier
    return config.rir_effort_default


def set_load(
    weight: float,
    reps: int,
    rir: int | None,
    body_weight: float,
    config: ScoringConfig = DEFAULT_CONFIG,
) -> float:
    """
    set_load = (weight * reps / body_weight) * E

    Assumes the caller has already established the set is scoreable
    (completed, non-warm-up, weight_reps) and that body_weight is resolved
    (never zero/None) -- see `is_scoreable_set` and `resolve_body_weights`.
    """
    if body_weight <= 0:
        body_weight = config.default_body_weight
    e = effort_multiplier(rir, config)
    return (weight * reps / body_weight) * e


def is_warmup_set(set_: Set, config: ScoringConfig = DEFAULT_CONFIG) -> bool:
    return set_.set_type_id is not None and set_.set_type_id in config.excluded_set_type_ids


def is_scoreable_set(exercise: Exercise, set_: Set, config: ScoringConfig = DEFAULT_CONFIG) -> bool:
    """
    Non-warm-up, weight_reps set with usable weight/reps.

    Deliberately ignores `is_completed`: real Lyfta data has whole workouts
    (including recent, clearly-performed ones) come back with every set
    flagged incomplete, so presence of usable weight/reps is treated as the
    signal that a set was actually done.
    """
    if is_warmup_set(set_, config):
        return False
    if exercise.exercise_type not in config.scored_exercise_types:
        return False
    if set_.weight is None or set_.reps is None:
        return False
    return True


def distinct_set_type_ids(workouts: Sequence[Workout]) -> set[str]:
    """All distinct set_type_ids seen across a batch of workouts, so the
    caller can figure out which one(s) mean "warm-up" and add them to
    config.EXCLUDED_SET_TYPE_IDS."""
    ids: set[str] = set()
    for w in workouts:
        for exercise in w.exercises:
            for s in exercise.sets:
                if s.set_type_id is not None:
                    ids.add(s.set_type_id)
    return ids


# --------------------------------------------------------------------------
# Body weight resolution
# --------------------------------------------------------------------------


def resolve_body_weights(
    workouts: Sequence[Workout], config: ScoringConfig = DEFAULT_CONFIG
) -> dict[str, float]:
    """
    Map workout.id -> resolved body weight. Workouts are walked in
    chronological order (by workout_perform_date); a workout missing
    body_weight uses the most recently seen prior value, or
    config.default_body_weight if none has been seen yet.
    """
    resolved: dict[str, float] = {}
    last_known: float | None = None
    for w in sorted(workouts, key=lambda w: w.workout_perform_date):
        if w.body_weight is not None:
            last_known = w.body_weight
            resolved[w.id] = w.body_weight
        else:
            resolved[w.id] = last_known if last_known is not None else config.default_body_weight
    return resolved


# --------------------------------------------------------------------------
# Session points
# --------------------------------------------------------------------------


def workout_set_loads(
    workout: Workout, body_weight: float, config: ScoringConfig = DEFAULT_CONFIG
) -> list[float]:
    """Load for every scoreable set in this workout."""
    loads = []
    for exercise in workout.exercises:
        for s in exercise.sets:
            if is_scoreable_set(exercise, s, config):
                loads.append(set_load(s.weight, s.reps, s.rir, body_weight, config))
    return loads


def raw_session_points(set_loads: Sequence[float], config: ScoringConfig = DEFAULT_CONFIG) -> float:
    """session_points = 10 * sqrt(sum of set loads), before same-day factor."""
    total = sum(set_loads)
    if total <= 0:
        return 0.0
    return config.session_points_multiplier * math.sqrt(total)


# --------------------------------------------------------------------------
# Progress bonus
# --------------------------------------------------------------------------


def epley_e1rm(weight: float, reps: int) -> float:
    """Estimated 1-rep max via the Epley formula."""
    return weight * (1 + reps / 30)


def best_e1rm_by_exercise(
    workout: Workout, config: ScoringConfig = DEFAULT_CONFIG
) -> dict[str, float]:
    """Best e1RM per exercise_id among this workout's scoreable sets."""
    best: dict[str, float] = {}
    for exercise in workout.exercises:
        for s in exercise.sets:
            if is_scoreable_set(exercise, s, config):
                e1rm = epley_e1rm(s.weight, s.reps)
                if exercise.exercise_id not in best or e1rm > best[exercise.exercise_id]:
                    best[exercise.exercise_id] = e1rm
    return best


def historical_best_e1rm(
    exercise_id: str,
    before_date: date,
    all_workouts: Sequence[Workout],
    config: ScoringConfig = DEFAULT_CONFIG,
) -> float | None:
    """
    Best e1RM for this exercise across workouts strictly within the lookback
    window before `before_date` (same-day workouts are excluded -- "the
    previous 6 weeks" is read as not including the session's own day).
    Returns None if there's no prior history at all for this exercise.
    """
    window_start = before_date - timedelta(days=config.progress_bonus_lookback_days)
    best: float | None = None
    for w in all_workouts:
        if not (window_start <= w.workout_perform_date < before_date):
            continue
        for exercise in w.exercises:
            if exercise.exercise_id != exercise_id:
                continue
            for s in exercise.sets:
                if is_scoreable_set(exercise, s, config):
                    e1rm = epley_e1rm(s.weight, s.reps)
                    if best is None or e1rm > best:
                        best = e1rm
    return best


def progress_bonus_points(
    workout: Workout,
    all_workouts: Sequence[Workout],
    config: ScoringConfig = DEFAULT_CONFIG,
) -> float:
    """
    +config.progress_bonus_points for each exercise (up to
    progress_bonus_max_per_session) where this session's best e1RM beats
    that exercise's best over the prior lookback window, PROVIDED there is
    prior history at all (no history => no bonus, per spec).
    """
    session_bests = best_e1rm_by_exercise(workout, config)
    bonus_count = 0
    for exercise_id, session_best in session_bests.items():
        if bonus_count >= config.progress_bonus_max_per_session:
            break
        hist_best = historical_best_e1rm(
            exercise_id, workout.workout_perform_date, all_workouts, config
        )
        if hist_best is not None and session_best > hist_best:
            bonus_count += 1
    return bonus_count * config.progress_bonus_points


# --------------------------------------------------------------------------
# Per-day aggregation + weekly consistency
# --------------------------------------------------------------------------


@dataclass
class DailyWorkoutPoints:
    date: date
    session_points: float  # sum across sessions that day, pre-weekly-multiplier
    bonus_points: float  # sum across sessions that day, pre-weekly-multiplier
    session_count: int
    breakdown: list[dict] = field(default_factory=list)  # per-session diagnostics, for the CLI


def daily_workout_points(
    workouts: Sequence[Workout], config: ScoringConfig = DEFAULT_CONFIG
) -> dict[date, DailyWorkoutPoints]:
    """
    Score every session and group by calendar day. Within a day, the first
    workout in the input list scores fully; later ones that day score at
    `additional_session_same_day_factor`. See module docstring re: ordering.
    """
    body_weights = resolve_body_weights(workouts, config)

    by_date: dict[date, list[Workout]] = defaultdict(list)
    for w in workouts:
        by_date[w.workout_perform_date].append(w)

    result: dict[date, DailyWorkoutPoints] = {}
    for day, day_workouts in by_date.items():
        total_session_points = 0.0
        total_bonus_points = 0.0
        breakdown = []
        for idx, w in enumerate(day_workouts):
            loads = workout_set_loads(w, body_weights[w.id], config)
            raw_points = raw_session_points(loads, config)
            factor = 1.0 if idx == 0 else config.additional_session_same_day_factor
            session_points = raw_points * factor
            bonus = progress_bonus_points(w, workouts, config)

            total_session_points += session_points
            total_bonus_points += bonus
            breakdown.append(
                {
                    "workout_id": w.id,
                    "title": w.title,
                    "body_weight": body_weights[w.id],
                    "scored_sets": len(loads),
                    "set_loads": loads,
                    "raw_session_points": raw_points,
                    "same_day_factor": factor,
                    "session_points": session_points,
                    "bonus_points": bonus,
                }
            )

        result[day] = DailyWorkoutPoints(
            date=day,
            session_points=total_session_points,
            bonus_points=total_bonus_points,
            session_count=len(day_workouts),
            breakdown=breakdown,
        )
    return result


def apply_weekly_consistency(
    daily_points: dict[date, DailyWorkoutPoints], config: ScoringConfig = DEFAULT_CONFIG
) -> dict[date, float]:
    """
    Return date -> final workout points for that day, after applying the
    weekly-consistency multiplier to weeks (Mon-Sun) that met the weekly
    session target.
    """
    weeks: dict[tuple[int, int], list[date]] = defaultdict(list)
    for day in daily_points:
        iso_year, iso_week, _ = day.isocalendar()
        weeks[(iso_year, iso_week)].append(day)

    final: dict[date, float] = {}
    for key, days in weeks.items():
        sessions_this_week = sum(daily_points[d].session_count for d in days)
        met_target = sessions_this_week >= config.weekly_session_target
        multiplier = config.weekly_consistency_multiplier if met_target else 1.0
        for d in days:
            dp = daily_points[d]
            final[d] = (dp.session_points + dp.bonus_points) * multiplier
    return final


def score_workout_history(
    workouts: Sequence[Workout], config: ScoringConfig = DEFAULT_CONFIG
) -> dict[date, float]:
    """Top-level entry point: workouts -> date -> final workout points for that day."""
    daily = daily_workout_points(workouts, config)
    return apply_weekly_consistency(daily, config)
