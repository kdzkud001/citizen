"""
All backend settings, loaded from the environment (with .env support). No
secrets are hardcoded; see ../.env.example for the full list of variables.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved relative to this file, not the process's working directory, so
# it doesn't matter whether the app is launched from repo root or backend/.
_ROOT_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ROOT_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # Postgres connection (the app's own tables live in the `public` schema
    # of the same Supabase Postgres instance that holds `auth.users`).
    database_url: str

    # Supabase project URL, e.g. https://xxxx.supabase.co -- used to build
    # the JWKS endpoint for verifying access tokens.
    supabase_url: str

    # Legacy shared JWT secret, only used to verify HS256 tokens issued
    # before a project migrates to asymmetric signing keys. Optional: a
    # project fully migrated to JWT signing keys doesn't need it.
    supabase_jwt_secret: str | None = None

    # Fernet key (44-byte urlsafe base64) used to encrypt Lyfta credentials
    # at rest. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    credential_encryption_key: str

    # Overlap window subtracted from last_synced_at before a sync, so a
    # workout logged right at the edge of the last sync isn't missed.
    lyfta_sync_overlap_days: int = 1

    # Set true only for local/single-instance dev convenience; production
    # should rely on scripts/sync_all.py run from cron instead (see README).
    enable_inprocess_scheduler: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
