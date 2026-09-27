from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class WorkoutRecord(Base):
    """
    One Lyfta workout as fetched. `raw_json` is always the full raw API
    payload -- scores must be recomputable from this at any time, so
    nothing here is normalized out of it beyond what's needed to
    upsert/query efficiently.
    """

    __tablename__ = "workouts"
    __table_args__ = (
        UniqueConstraint("user_id", "lyfta_workout_id", name="uq_workouts_user_lyfta_id"),
        Index("ix_workouts_user_perform_date", "user_id", "perform_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app.profiles.id", ondelete="CASCADE"), nullable=False
    )
    lyfta_workout_id: Mapped[str] = mapped_column(String, nullable=False)
    perform_date: Mapped[date] = mapped_column(Date, nullable=False)
    raw_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
