from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from citizenship_score.config import (
    DEFAULT_HABIT_CATEGORY,
    DEFAULT_HABIT_WEEKLY_TARGET,
    HABIT_CATEGORIES,
)


def _validate_category(value: str | None) -> str | None:
    if value is not None and value not in HABIT_CATEGORIES:
        raise ValueError(f"category must be one of {list(HABIT_CATEGORIES)}")
    return value


class HabitCreate(BaseModel):
    name: str
    category: str = DEFAULT_HABIT_CATEGORY
    weekly_target: int = Field(default=DEFAULT_HABIT_WEEKLY_TARGET, ge=1, le=7)

    _check_category = field_validator("category")(_validate_category)


class HabitUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    weekly_target: int | None = Field(default=None, ge=1, le=7)
    active: bool | None = None

    _check_category = field_validator("category")(_validate_category)


class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    weekly_target: int
    active: bool


class HabitWithCompletionOut(HabitOut):
    """HabitOut plus whether it was completed on the date the caller asked
    about -- only returned by the list endpoint's ?for_date= query, since
    create/update have no such date context."""

    completed_on_date: bool


class HabitLogRequest(BaseModel):
    completed_on: date
