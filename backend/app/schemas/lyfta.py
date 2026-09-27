from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ConnectLyftaRequest(BaseModel):
    api_key: str


class SyncResult(BaseModel):
    synced_count: int
    status: str


class LyftaStatusOut(BaseModel):
    connected: bool
    last_synced_at: datetime | None = None
    last_sync_status: str | None = None
