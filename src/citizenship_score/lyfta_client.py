"""
Minimal client for the Lyfta workouts API.

Handles:
- reading LYFTA_API_KEY from the environment (with .env support)
- toggling between the live and sandbox base URLs
- pagination (current_page / total_pages / limit)
- basic rate-limit pacing (60/min) and exponential backoff on 429/5xx

Response shape (confirmed against the live sandbox endpoint):
    {"status": true, "sandbox": true, "count": N, "total_records": N,
     "total_pages": M, "current_page": P, "limit": L, "workouts": [...]}
"""

from __future__ import annotations

import os
import time
from collections.abc import Iterator
from datetime import date

import httpx
from dotenv import load_dotenv

from citizenship_score.config import (
    LYFTA_BACKOFF_BASE_SECONDS,
    LYFTA_BACKOFF_MAX_RETRIES,
    LYFTA_LIVE_BASE_URL,
    LYFTA_RATE_LIMIT_PER_MINUTE,
    LYFTA_SANDBOX_BASE_URL,
)


class LyftaAuthError(RuntimeError):
    """Raised when a live-mode request is attempted without an API key."""


class LyftaApiError(RuntimeError):
    """Raised when the API returns an error we can't recover from via retry."""


def get_api_key(env_file: str | None = None) -> str | None:
    """
    Load LYFTA_API_KEY from the environment, reading a .env file first if
    present (defaults to `.env` in the current working directory).
    """
    load_dotenv(dotenv_path=env_file, override=False)
    return os.environ.get("LYFTA_API_KEY")


class LyftaClient:
    def __init__(
        self,
        api_key: str | None = None,
        sandbox: bool = False,
        transport: httpx.BaseTransport | None = None,
        rate_limit_per_minute: int = LYFTA_RATE_LIMIT_PER_MINUTE,
        backoff_base_seconds: float = LYFTA_BACKOFF_BASE_SECONDS,
        max_retries: int = LYFTA_BACKOFF_MAX_RETRIES,
        sleep: callable = time.sleep,
    ) -> None:
        self.sandbox = sandbox
        self.base_url = LYFTA_SANDBOX_BASE_URL if sandbox else LYFTA_LIVE_BASE_URL
        self.api_key = api_key if api_key is not None else get_api_key()
        if not sandbox and not self.api_key:
            raise LyftaAuthError(
                "LYFTA_API_KEY is not set. Add it to your .env file or environment "
                "(sandbox mode doesn't require a key: pass sandbox=True)."
            )
        self._min_interval = 60.0 / rate_limit_per_minute if rate_limit_per_minute > 0 else 0.0
        self._backoff_base = backoff_base_seconds
        self._max_retries = max_retries
        self._sleep = sleep
        self._last_request_time: float | None = None

        headers = {}
        if not sandbox:
            headers["Authorization"] = f"Bearer {self.api_key}"
        self._client = httpx.Client(base_url=self.base_url, headers=headers, transport=transport)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "LyftaClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()

    # ----------------------------------------------------------------

    def _pace(self) -> None:
        """Sleep just enough to respect the per-minute rate limit."""
        if self._min_interval <= 0 or self._last_request_time is None:
            return
        elapsed = time.monotonic() - self._last_request_time
        remaining = self._min_interval - elapsed
        if remaining > 0:
            self._sleep(remaining)

    def _get(self, path: str, params: dict) -> dict:
        for attempt in range(self._max_retries + 1):
            self._pace()
            self._last_request_time = time.monotonic()
            response = self._client.get(path, params=params)

            if response.status_code == 200:
                return response.json()

            if response.status_code == 429 or response.status_code >= 500:
                if attempt >= self._max_retries:
                    raise LyftaApiError(
                        f"Lyfta API request to {path} failed after {attempt + 1} attempts "
                        f"(status {response.status_code})."
                    )
                retry_after = response.headers.get("Retry-After")
                delay = float(retry_after) if retry_after else self._backoff_base * (2**attempt)
                self._sleep(delay)
                continue

            raise LyftaApiError(
                f"Lyfta API request to {path} failed with status {response.status_code}: "
                f"{response.text}"
            )

        raise LyftaApiError(f"Lyfta API request to {path} exhausted retries.")

    @staticmethod
    def _extract_page(payload: dict) -> tuple[list[dict], int, int]:
        """Returns (workouts, current_page, total_pages) from a page response."""
        workouts = payload.get("workouts", [])
        current_page = payload.get("current_page", 1)
        total_pages = payload.get("total_pages", 1)
        return workouts, current_page, total_pages

    def iter_workouts(
        self, date_from: date | None = None, date_to: date | None = None
    ) -> Iterator[dict]:
        """Yield raw workout dicts across all pages."""
        page = 1
        params: dict = {}
        if date_from is not None:
            params["from"] = date_from.isoformat()
        if date_to is not None:
            params["to"] = date_to.isoformat()

        while True:
            page_params = {**params, "page": page}
            payload = self._get("/workouts", page_params)
            workouts, current_page, total_pages = self._extract_page(payload)
            yield from workouts
            if current_page >= total_pages:
                break
            page = current_page + 1

    def fetch_workouts(
        self, date_from: date | None = None, date_to: date | None = None
    ) -> list[dict]:
        """Fetch and return all raw workout dicts across all pages."""
        return list(self.iter_workouts(date_from, date_to))
