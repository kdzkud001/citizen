from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class DailyScore(Base):
    """
    A CACHE row, one per (user, date). Entirely derived from raw workouts +
    habit_logs -- always safe to delete and rebuild via
    app.services.scoring.recompute_user_scores. Never write to this table
    except from that function.
    """

    __tablename__ = "daily_scores"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app.profiles.id", ondelete="CASCADE"), primary_key=True
    )
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    workout_points: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    habit_points: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    rolling_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    class_name: Mapped[str] = mapped_column(String, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
