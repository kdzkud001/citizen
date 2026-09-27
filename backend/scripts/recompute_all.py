"""
Rebuild daily_scores for every user, from their raw workouts + habit logs.

Run this whenever the scoring formula changes (citizenship_score.config),
and also schedule it to run once a day regardless of Lyfta sync activity --
that's what makes a habit-only user (or anyone who's disconnected Lyfta)
still decay and demote through today instead of their cache going stale.

Usage: python -m scripts.recompute_all
"""

from __future__ import annotations

import logging

from sqlalchemy import select

from app.db import SessionLocal
from app.models.profile import Profile
from app.services.scoring import recompute_user_scores

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def recompute_all_users() -> None:
    db = SessionLocal()
    try:
        user_ids = list(db.scalars(select(Profile.id)))
        for user_id in user_ids:
            try:
                recompute_user_scores(db, user_id)
            except Exception:
                logger.exception("Failed to recompute scores for user_id=%s", user_id)
        logger.info("Recomputed scores for %d user(s)", len(user_ids))
    finally:
        db.close()


if __name__ == "__main__":
    recompute_all_users()
