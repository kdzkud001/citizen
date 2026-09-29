from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from citizenship_score.config import DEFAULT_CONFIG, ScoringConfig
from citizenship_score.models import Workout as PhaseWorkout
from citizenship_score.scoring.workouts import daily_workout_points

from app.auth import get_current_profile
from app.db import get_db
from app.models.daily_score import DailyScore
from app.models.profile import Profile
from app.models.workout import WorkoutRecord
from app.schemas.me import ProfileOut, ProfileUpdate
from app.schemas.score import (
    DailyScoreOut,
    DailyWorkoutsOut,
    ScoreSummary,
    SessionBreakdown,
    WheelOut,
    WheelSpokeOut,
    WheelWindowOut,
)
from app.services.scoring import compute_wheel, points_to_next_class, recompute_user_scores, today_utc

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ProfileOut)
def get_me(profile: Profile = Depends(get_current_profile)) -> Profile:
    return profile


@router.patch("", response_model=ProfileOut)
def update_me(
    body: ProfileUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> Profile:
    changed_target = False
    if body.display_name is not None:
        profile.display_name = body.display_name
    if body.weekly_session_target is not None:
        profile.weekly_session_target = body.weekly_session_target
        changed_target = True
    db.commit()
    db.refresh(profile)
    if changed_target:
        # The weekly target feeds the weekly-consistency multiplier, so a
        # change here changes past scores too.
        recompute_user_scores(db, profile.id)
    return profile


@router.get("/score", response_model=ScoreSummary)
def get_score(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> ScoreSummary:
    today = today_utc()
    row = db.get(DailyScore, (profile.id, today))
    if row is None:
        recompute_user_scores(db, profile.id)
        row = db.get(DailyScore, (profile.id, today))

    window_start = today - timedelta(days=DEFAULT_CONFIG.rolling_window_days - 1)
    history = list(
        db.scalars(
            select(DailyScore)
            .where(DailyScore.user_id == profile.id, DailyScore.date >= window_start)
            .order_by(DailyScore.date)
        )
    )

    return ScoreSummary(
        today=DailyScoreOut.model_validate(row),
        points_to_next_class=points_to_next_class(row.rolling_score, DEFAULT_CONFIG),
        history=[DailyScoreOut.model_validate(h) for h in history],
    )


@router.get("/workouts", response_model=list[DailyWorkoutsOut])
def get_recent_workouts(
    days: int = 30,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> list[DailyWorkoutsOut]:
    config = ScoringConfig(weekly_session_target=profile.weekly_session_target)
    raw_workouts = [
        w.raw_json for w in db.scalars(select(WorkoutRecord).where(WorkoutRecord.user_id == profile.id))
    ]
    workouts = [PhaseWorkout.model_validate(w) for w in raw_workouts]
    daily = daily_workout_points(workouts, config)

    cutoff = today_utc() - timedelta(days=days)
    return [
        DailyWorkoutsOut(
            date=day,
            sessions=[SessionBreakdown(**session) for session in dp.breakdown],
        )
        for day, dp in sorted(daily.items(), reverse=True)
        if day >= cutoff
    ]


@router.get("/wheel", response_model=WheelOut)
def get_wheel(
    days: int = Query(default=DEFAULT_CONFIG.wheel_window_days, ge=1, le=365),
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> WheelOut:
    """Wellness wheel for the last `days` days (ending today, UTC) and the
    same-length window immediately before it."""
    today = today_utc()
    current, previous = compute_wheel(db, profile.id, days, as_of=today)

    def window(end, spokes) -> WheelWindowOut:
        return WheelWindowOut(
            start=end - timedelta(days=days - 1),
            end=end,
            spokes=[WheelSpokeOut.model_validate(s) for s in spokes],
        )

    return WheelOut(
        days=days,
        current=window(today, current),
        previous=window(today - timedelta(days=days), previous),
    )
