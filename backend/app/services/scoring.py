"""
The one seam between our DB-backed rows and the Phase 0 `citizenship_score`
engine. `build_score_history` is a pure function (no DB, no I/O) so it's
unit-testable on its own; `recompute_user_scores` is the thin DB wrapper the
spec calls for, and the only thing allowed to write daily_scores.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from citizenship_score.config import ScoringConfig
from citizenship_score.models import HabitCompletion, HabitDefinition, Workout
from citizenship_score.scoring.classes import score_classes
from citizenship_score.scoring.habits import score_habit_completions
from citizenship_score.scoring.wheel import WheelSpoke, wellness_wheel
from citizenship_score.scoring.workouts import scored_session_dates, score_workout_history

from app.models.daily_score import DailyScore
from app.models.habit import Habit, HabitLog
from app.models.lyfta_connection import LyftaConnection
from app.models.profile import Profile
from app.models.workout import WorkoutRecord


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def build_score_history(
    raw_workouts: list[dict],
    habits: list[HabitDefinition],
    habit_completions: list[HabitCompletion],
    config: ScoringConfig,
    as_of: date | None = None,
) -> list[dict]:
    """
    raw workout dicts + habits -> one row per calendar day, from the
    earliest activity through `as_of` (default: today UTC).

    Explicitly seeding `as_of` into the combined points dict (even at 0.0)
    is what makes the rolling window and promotion/demotion hysteresis walk
    forward through today on a quiet day -- `citizenship_score`'s own
    rolling_scores() only walks from the earliest to the *latest* day it's
    given, so a stale user without this would never decay or demote.
    """
    as_of = as_of or today_utc()
    workouts = [Workout.model_validate(w) for w in raw_workouts]

    workout_points = score_workout_history(workouts, config)
    habit_points = score_habit_completions(
        habit_completions, habits, scored_session_dates(workouts, config), config, as_of=as_of
    )

    combined: dict[date, float] = defaultdict(float)
    for d, p in workout_points.items():
        combined[d] += p
    for d, p in habit_points.items():
        combined[d] += p
    combined.setdefault(as_of, 0.0)

    rows = []
    for daily_class in score_classes(dict(combined), config):
        if daily_class.date > as_of:
            continue
        rows.append(
            {
                "date": daily_class.date,
                "workout_points": workout_points.get(daily_class.date, 0.0),
                "habit_points": habit_points.get(daily_class.date, 0.0),
                "rolling_score": daily_class.rolling_score,
                "class_name": daily_class.class_name,
            }
        )
    return rows


def points_to_next_class(rolling_score: float, config: ScoringConfig) -> float | None:
    """How many more rolling-score points until the next class's lower
    threshold is crossed. None if already in the top class."""
    thresholds = config.class_thresholds
    for _, lower in thresholds:
        if lower > rolling_score:
            return lower - rolling_score
    return None


@dataclass
class ScoringInputs:
    config: ScoringConfig
    raw_workouts: list[dict]
    habits: list[HabitDefinition]
    completions: list[HabitCompletion]
    lyfta_connected: bool


def load_scoring_inputs(db: Session, user_id: uuid.UUID) -> ScoringInputs:
    profile = db.get(Profile, user_id)
    if profile is None:
        raise ValueError(f"No profile for user_id={user_id}")

    return ScoringInputs(
        config=ScoringConfig(weekly_session_target=profile.weekly_session_target),
        raw_workouts=[
            w.raw_json
            for w in db.scalars(select(WorkoutRecord).where(WorkoutRecord.user_id == user_id))
        ],
        habits=[
            HabitDefinition(
                habit_id=str(h.id), category=h.category, weekly_target=h.weekly_target, active=h.active
            )
            for h in db.scalars(select(Habit).where(Habit.user_id == user_id))
        ],
        completions=[
            HabitCompletion(habit_id=str(log.habit_id), completed_on=log.completed_on)
            for log in db.scalars(select(HabitLog).where(HabitLog.user_id == user_id))
        ],
        lyfta_connected=db.get(LyftaConnection, user_id) is not None,
    )


def recompute_user_scores(db: Session, user_id: uuid.UUID, as_of: date | None = None) -> None:
    """Load a user's raw workouts + habits, rescoring and rewriting their
    entire daily_scores history. Safe to call any time (e.g. after every
    sync, after every habit change, and from the daily all-users recompute
    job) since it's fully derived from raw data."""
    inputs = load_scoring_inputs(db, user_id)
    rows = build_score_history(
        inputs.raw_workouts, inputs.habits, inputs.completions, inputs.config, as_of=as_of
    )

    db.execute(delete(DailyScore).where(DailyScore.user_id == user_id))
    db.add_all(DailyScore(user_id=user_id, **row) for row in rows)
    db.commit()


def compute_wheel(
    db: Session, user_id: uuid.UUID, days: int, as_of: date | None = None
) -> tuple[list[WheelSpoke], list[WheelSpoke]]:
    """(current window ending today, previous window of the same length
    immediately before it). Computed live from raw data, not cached."""
    as_of = as_of or today_utc()
    inputs = load_scoring_inputs(db, user_id)
    sessions = scored_session_dates(
        [Workout.model_validate(w) for w in inputs.raw_workouts], inputs.config
    )

    def window(end: date) -> list[WheelSpoke]:
        return wellness_wheel(
            inputs.habits,
            inputs.completions,
            sessions,
            inputs.config.weekly_session_target,
            inputs.lyfta_connected,
            end,
            days,
            inputs.config,
        )

    return window(as_of), window(as_of - timedelta(days=days))
