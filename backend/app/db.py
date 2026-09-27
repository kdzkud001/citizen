"""
SQLAlchemy engine/session setup. Sync engine (psycopg 3) -- see README for
why: this app's traffic is low-volume and personal-scale, so the async
driver's extra moving parts (asyncpg + Supabase's pooled-connection prepared
statement caveats) buy nothing here.
"""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine
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
