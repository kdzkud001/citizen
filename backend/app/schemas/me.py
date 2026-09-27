from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str | None
    weekly_session_target: int


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    weekly_session_target: int | None = Field(default=None, ge=1, le=14)
