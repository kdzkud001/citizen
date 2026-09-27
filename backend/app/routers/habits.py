from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_profile
from app.db import get_db
from app.models.habit import Habit, HabitLog
from app.models.profile import Profile
from app.schemas.habits import HabitCreate, HabitLogRequest, HabitOut, HabitUpdate
from app.services.scoring import recompute_user_scores, today_utc

router = APIRouter(prefix="/habits", tags=["habits"])


def _get_owned_habit(db: Session, profile: Profile, habit_id: uuid.UUID) -> Habit:
    habit = db.get(Habit, habit_id)
    if habit is None or habit.user_id != profile.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Habit not found")
    return habit


@router.post("", response_model=HabitOut, status_code=status.HTTP_201_CREATED)
def create_habit(
    body: HabitCreate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> Habit:
    habit = Habit(user_id=profile.id, name=body.name)
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.get("", response_model=list[HabitOut])
def list_habits(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> list[Habit]:
    return list(db.scalars(select(Habit).where(Habit.user_id == profile.id)))


@router.patch("/{habit_id}", response_model=HabitOut)
def update_habit(
    habit_id: uuid.UUID,
    body: HabitUpdate,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> Habit:
    habit = _get_owned_habit(db, profile, habit_id)
    if body.name is not None:
        habit.name = body.name
    if body.active is not None:
        habit.active = body.active
    db.commit()
    db.refresh(habit)
    return habit


@router.post("/{habit_id}/completions", status_code=status.HTTP_204_NO_CONTENT)
def log_completion(
    habit_id: uuid.UUID,
    body: HabitLogRequest,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> None:
    _get_owned_habit(db, profile, habit_id)
    today = today_utc()
    if body.completed_on not in (today, today - timedelta(days=1)):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Only today or yesterday can be logged (no backfill)"
        )

    db.add(HabitLog(habit_id=habit_id, user_id=profile.id, completed_on=body.completed_on))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # already logged for that day -- treat as a no-op, not an error
        return

    recompute_user_scores(db, profile.id)


@router.delete("/{habit_id}/completions/{completed_on}", status_code=status.HTTP_204_NO_CONTENT)
def delete_completion(
    habit_id: uuid.UUID,
    completed_on: str,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> None:
    _get_owned_habit(db, profile, habit_id)
    parsed_date = date.fromisoformat(completed_on)
    log = db.scalar(
        select(HabitLog).where(HabitLog.habit_id == habit_id, HabitLog.completed_on == parsed_date)
    )
    if log is not None:
        db.delete(log)
        db.commit()
        recompute_user_scores(db, profile.id)
