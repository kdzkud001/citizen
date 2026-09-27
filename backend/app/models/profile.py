from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Profile(Base):
    """
    One row per Supabase-authenticated user. `id` is the Supabase
    `auth.users.id` -- Supabase's own documented pattern is to FK a
    `profiles` table straight to `auth.users`, even though that schema is
    Supabase-managed rather than ours: the table already exists by the time
    our migrations run, and `ON DELETE CASCADE` means deleting a Supabase
    user cleans up every row that hangs off their profile automatically.
    Created lazily on a user's first authenticated request, rather than a
    trigger on `auth.users` -- see app/auth.py.
    """

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    weekly_session_target: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
