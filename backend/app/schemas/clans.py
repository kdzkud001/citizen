from __future__ import annotations

import uuid

from pydantic import BaseModel


class ClanCreate(BaseModel):
    name: str


class JoinClanRequest(BaseModel):
    invite_code: str


class ClanMemberOut(BaseModel):
    display_name: str | None
    rolling_score: float
    class_name: str


class ClanOut(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    clan_score: float
    participation: float
    is_owner: bool
    members: list[ClanMemberOut]
