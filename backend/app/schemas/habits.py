from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class HabitCreate(BaseModel):
    name: str


class HabitUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    active: bool


class HabitWithCompletionOut(HabitOut):
    """HabitOut plus whether it was completed on the date the caller asked
    about -- only returned by the list endpoint's ?for_date= query, since
    create/update have no such date context."""

    completed_on_date: bool


class HabitLogRequest(BaseModel):
    completed_on: date
