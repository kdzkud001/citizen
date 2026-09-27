"""
SQLAlchemy engine/session setup. Sync engine (psycopg 3) -- see README for
why: this app's traffic is low-volume and personal-scale, so the async
driver's extra moving parts (asyncpg + Supabase's pooled-connection prepared
statement caveats) buy nothing here.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import Column, MetaData, Table, create_engine
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

# Every app table lives in a private `app` schema, never `public`. A
# Supabase project's Data API (PostgREST) can expose `public` tables
# directly to anon/authenticated clients if that schema's role grants are
# enabled -- entirely bypassing this backend's own ownership checks. Putting
# our tables in a schema the Data API was never configured to expose avoids
# that regardless of a given project's Data API settings.
APP_SCHEMA = "app"


class Base(DeclarativeBase):
    metadata = MetaData(schema=APP_SCHEMA)


# A bare-bones stand-in for Supabase's own auth.users, registered on this
# same MetaData purely so profiles.id's FK can resolve -- SQLAlchemy needs
# the referenced table as a registered Table object to compute DDL
# dependency order, even though Alembic's hand-written migration never
# creates or touches it (Supabase provisions the real auth.users; our own
# migration only emits a plain `REFERENCES auth.users(id)` string, which
# Postgres resolves against the real table). Tests run against a plain
# Postgres container with no `auth` schema at all, so `Base.metadata.create_all`
# creates this too there, standing in for the real thing.
auth_users_table = Table(
    "users",
    Base.metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    schema="auth",
)


def make_engine(database_url: str | None = None):
    url = database_url or get_settings().database_url
    return create_engine(url, pool_pre_ping=True, future=True)


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
