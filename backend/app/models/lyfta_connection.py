from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class LyftaConnection(Base):
    """
    A user's link to their Lyfta account. `encrypted_credential` is a
    Fernet-encrypted JSON blob rather than a single plain column, so its
    *shape* can change by `method` (today: {"api_key": "..."}; later, OAuth:
    {"access_token": ..., "refresh_token": ..., "expires_at": ...}) without
    an Alembic migration. One connection per user (`user_id` is the PK).
    """

    __tablename__ = "lyfta_connections"
    __table_args__ = (CheckConstraint("method IN ('api_key', 'oauth')", name="ck_lyfta_method"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app.profiles.id", ondelete="CASCADE"), primary_key=True
    )
    method: Mapped[str] = mapped_column(String, nullable=False, default="api_key")
    encrypted_credential: Mapped[str] = mapped_column(Text, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_status: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
