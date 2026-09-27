"""
Test fixtures. Requires a real Postgres reachable at TEST_DATABASE_URL
(defaults to the docker-compose service in backend/docker-compose.yml) --
sqlite can't stand in here since we rely on real jsonb/uuid Postgres
behavior. Tests must never point at a production database: `db_session`
creates and drops every table fresh per test, which would be catastrophic
against real data.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://citizenship:citizenship@localhost:55432/citizenship_test",
    ),
)
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-not-real")
os.environ.setdefault("CREDENTIAL_ENCRYPTION_KEY", Fernet.generate_key().decode())

from app import db as db_module  # noqa: E402
from app.db import APP_SCHEMA, Base  # noqa: E402
from app.main import app  # noqa: E402

TEST_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(os.environ["DATABASE_URL"], future=True)
    yield eng
    eng.dispose()


@pytest.fixture
def db_session(engine):
    """Fresh schema per test -- only paid for by tests that actually
    request `db_session` (or `client`, which depends on it), not by
    DB-free pure-function tests.

    Also stubs a minimal `auth.users` table: `profiles.id` has a real FK to
    Supabase's `auth.users`, which doesn't exist on the plain docker-compose
    Postgres tests run against, so a bare-bones stand-in is created here
    (schema/table creation is idempotent; the `user_id`/`other_user_id`
    fixtures insert the actual per-test rows into it)."""
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS auth"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text)"))
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {APP_SCHEMA}"))

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def make_access_token(user_id: uuid.UUID, *, exp_delta: timedelta | None = timedelta(days=1)) -> str:
    """A valid-looking HS256 Supabase access token, signed with the same
    test secret the app is configured to verify against."""
    exp_time = datetime.now(timezone.utc) + (exp_delta if exp_delta is not None else timedelta(seconds=-1))
    payload = {
        "sub": str(user_id),
        "aud": "authenticated",
        "iss": f"{os.environ['SUPABASE_URL']}/auth/v1",
        "email": f"{user_id}@example.com",
        "exp": int(exp_time.timestamp()),
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture
def token_factory():
    return make_access_token


def _insert_auth_user(db_session, uid: uuid.UUID) -> None:
    db_session.execute(
        text("INSERT INTO auth.users (id, email) VALUES (:id, :email)"),
        {"id": uid, "email": f"{uid}@example.com"},
    )
    db_session.commit()


@pytest.fixture
def user_id(db_session) -> uuid.UUID:
    uid = uuid.uuid4()
    _insert_auth_user(db_session, uid)
    return uid


@pytest.fixture
def auth_headers(user_id):
    return {"Authorization": f"Bearer {make_access_token(user_id)}"}


@pytest.fixture
def client(db_session, engine):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[db_module.get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def other_user_id(db_session) -> uuid.UUID:
    uid = uuid.uuid4()
    _insert_auth_user(db_session, uid)
    return uid


@pytest.fixture
def other_auth_headers(other_user_id):
    return {"Authorization": f"Bearer {make_access_token(other_user_id)}"}
