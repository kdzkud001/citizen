"""
Verifies Supabase-issued access tokens on every request.

Supabase has moved from a single shared HS256 secret to per-project
asymmetric signing keys (ES256/RS256) published at
`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`, with zero-downtime rotation
(docs: https://supabase.com/docs/guides/auth/signing-keys). The old shared
secret still works for projects that haven't migrated. Rather than assume
one or the other, this branches on the token's own `alg` header: HS256
verifies against SUPABASE_JWT_SECRET, anything else is resolved against the
JWKS endpoint by `kid` (PyJWT's PyJWKClient caches keys and refetches on an
unrecognized `kid`, so key rotation on Supabase's side needs no redeploy
here).
"""

from __future__ import annotations

import uuid
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models.profile import Profile

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def _jwks_client() -> PyJWKClient:
    settings = get_settings()
    return PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def _decode_token(token: str) -> dict:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token") from exc

    alg = header.get("alg")
    issuer = f"{settings.supabase_url}/auth/v1"

    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status.HTTP_401_UNAUTHORIZED,
                    "HS256 token received but SUPABASE_JWT_SECRET is not configured",
                )
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=issuer,
            )
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=[alg],
            audience="authenticated",
            issuer=issuer,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}") from exc


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    claims = _decode_token(credentials.credentials)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing 'sub' claim")
    return uuid.UUID(sub)


def get_current_profile(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> Profile:
    """Get-or-create: a profile row is created on a user's first
    authenticated request rather than via a Supabase-side trigger, since
    the `auth` schema isn't ours to migrate."""
    profile = db.get(Profile, user_id)
    if profile is None:
        profile = Profile(id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile
