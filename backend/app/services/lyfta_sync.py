"""
Connecting a Lyfta account, syncing its workouts, and keeping
lyfta_connections' sync bookkeeping (last_synced_at, last_sync_status)
up to date. Reuses citizenship_score.lyfta_client.LyftaClient as-is --
it already takes a per-user api_key and handles the 60/min rate limit and
429/5xx backoff on its own.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from citizenship_score.lyfta_client import LyftaApiError, LyftaAuthError, LyftaClient
from citizenship_score.models import Workout as PhaseWorkout

from app.config import get_settings
from app.models.lyfta_connection import LyftaConnection
from app.models.workout import WorkoutRecord
from app.services.crypto import decrypt_credential, encrypt_credential
from app.services.scoring import recompute_user_scores


class LyftaValidationError(RuntimeError):
    """Raised when a submitted API key fails a live test call, or a sync is
    attempted with no connection in place."""


def validate_api_key(api_key: str) -> None:
    """One cheap test call -- a single day's page is enough to prove the
    key is accepted without pulling real history."""
    client = LyftaClient(api_key=api_key)
    try:
        next(client.iter_workouts(date_from=date.today(), date_to=date.today()), None)
    except (LyftaAuthError, LyftaApiError) as exc:
        raise LyftaValidationError(str(exc)) from exc
    finally:
        client.close()


def connect_lyfta(db: Session, user_id: uuid.UUID, api_key: str) -> None:
    validate_api_key(api_key)
    encrypted = encrypt_credential({"api_key": api_key})
    conn = db.get(LyftaConnection, user_id)
    if conn is None:
        conn = LyftaConnection(user_id=user_id, method="api_key", encrypted_credential=encrypted)
        db.add(conn)
    else:
        conn.method = "api_key"
        conn.encrypted_credential = encrypted
        conn.last_synced_at = None
        conn.last_sync_status = None
    db.commit()


def disconnect_lyfta(db: Session, user_id: uuid.UUID) -> None:
    conn = db.get(LyftaConnection, user_id)
    if conn is not None:
        db.delete(conn)
        db.commit()


def _upsert_workout(db: Session, user_id: uuid.UUID, raw: dict) -> None:
    perform_date = PhaseWorkout.model_validate(raw).workout_perform_date
    stmt = (
        pg_insert(WorkoutRecord)
        .values(
            user_id=user_id,
            lyfta_workout_id=str(raw["id"]),
            perform_date=perform_date,
            raw_json=raw,
        )
        .on_conflict_do_update(
            index_elements=[WorkoutRecord.user_id, WorkoutRecord.lyfta_workout_id],
            set_={"perform_date": perform_date, "raw_json": raw, "fetched_at": datetime.now(timezone.utc)},
        )
    )
    db.execute(stmt)


def sync_user(db: Session, user_id: uuid.UUID) -> dict:
    """Fetch workouts since last_synced_at (minus a small overlap window),
    upsert them, recompute scores, and record sync status. Raises
    LyftaValidationError if there's no connection, or re-raises the
    underlying Lyfta error after recording it as the sync status."""
    conn = db.get(LyftaConnection, user_id)
    if conn is None:
        raise LyftaValidationError("No Lyfta connection for this user")

    credential = decrypt_credential(conn.encrypted_credential)
    overlap = timedelta(days=get_settings().lyfta_sync_overlap_days)
    date_from = (conn.last_synced_at - overlap).date() if conn.last_synced_at else None

    client = LyftaClient(api_key=credential["api_key"])
    try:
        raw_workouts = client.fetch_workouts(date_from=date_from)
    except (LyftaAuthError, LyftaApiError) as exc:
        conn.last_sync_status = f"error: {exc}"
        db.commit()
        raise
    finally:
        client.close()

    for raw in raw_workouts:
        _upsert_workout(db, user_id, raw)

    conn.last_synced_at = datetime.now(timezone.utc)
    conn.last_sync_status = "ok"
    db.commit()

    recompute_user_scores(db, user_id)

    return {"synced_count": len(raw_workouts), "status": "ok"}
