from __future__ import annotations

from pydantic import BaseModel


class ConnectLyftaRequest(BaseModel):
    api_key: str


class SyncResult(BaseModel):
    synced_count: int
    status: str
