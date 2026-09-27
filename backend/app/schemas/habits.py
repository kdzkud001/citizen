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


class HabitLogRequest(BaseModel):
    completed_on: date
