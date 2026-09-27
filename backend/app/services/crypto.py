"""
Encrypt/decrypt the JSON credential blob stored in
lyfta_connections.encrypted_credential. Fernet gives us authenticated
symmetric encryption with a single env-var key -- no key management system
needed at this scale, but the key must never be committed or logged.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet

from app.config import get_settings


@lru_cache
def _fernet() -> Fernet:
    return Fernet(get_settings().credential_encryption_key.encode())


def encrypt_credential(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload).encode()
    return _fernet().encrypt(raw).decode()


def decrypt_credential(token: str) -> dict[str, Any]:
    raw = _fernet().decrypt(token.encode())
    return json.loads(raw.decode())
