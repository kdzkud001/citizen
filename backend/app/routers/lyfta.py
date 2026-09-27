from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from citizenship_score.lyfta_client import LyftaApiError, LyftaAuthError

from app.auth import get_current_profile
from app.db import get_db
from app.models.lyfta_connection import LyftaConnection
from app.models.profile import Profile
from app.schemas.lyfta import ConnectLyftaRequest, LyftaStatusOut, SyncResult
from app.services.lyfta_sync import LyftaValidationError, connect_lyfta, disconnect_lyfta, sync_user

router = APIRouter(prefix="/me/lyfta", tags=["lyfta"])


@router.get("", response_model=LyftaStatusOut)
def status_(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> LyftaStatusOut:
    conn = db.get(LyftaConnection, profile.id)
    if conn is None:
        return LyftaStatusOut(connected=False)
    return LyftaStatusOut(
        connected=True, last_synced_at=conn.last_synced_at, last_sync_status=conn.last_sync_status
    )


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
def connect(
    body: ConnectLyftaRequest,
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> None:
    try:
        connect_lyfta(db, profile.id, body.api_key)
    except LyftaValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def disconnect(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> None:
    disconnect_lyfta(db, profile.id)


@router.post("/sync", response_model=SyncResult)
def sync(
    profile: Profile = Depends(get_current_profile),
    db: Session = Depends(get_db),
) -> SyncResult:
    try:
        result = sync_user(db, profile.id)
    except LyftaValidationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except (LyftaAuthError, LyftaApiError) as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return SyncResult(**result)
