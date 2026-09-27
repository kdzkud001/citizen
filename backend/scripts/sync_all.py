"""
Sync every user with a Lyfta connection, roughly hourly. Intended to be run
from an external scheduler (OS cron / Windows Task Scheduler) rather than
in-process -- see README for the tradeoff vs. APScheduler.

Usage: python -m scripts.sync_all
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.db import SessionLocal
from app.models.lyfta_connection import LyftaConnection
from app.services.lyfta_sync import sync_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def sync_all_connected_users() -> None:
    db = SessionLocal()
    try:
        user_ids = list(db.scalars(select(LyftaConnection.user_id)))
        for user_id in user_ids:
            try:
                result = sync_user(db, user_id)
                logger.info("Synced user_id=%s: %s", user_id, result)
            except Exception:
                logger.exception("Failed to sync user_id=%s", user_id)
    finally:
        db.close()


if __name__ == "__main__":
    sync_all_connected_users()
