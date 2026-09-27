import json
from pathlib import Path

import httpx
import pytest

from citizenship_score.lyfta_client import LyftaApiError, LyftaAuthError, LyftaClient

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sandbox_workouts.json"


@pytest.fixture(autouse=True)
def _no_real_dotenv(monkeypatch):
    """
    Never let tests touch the real project .env (which has a real API key) --
    lyfta_client.get_api_key() calls load_dotenv() which would otherwise walk
    up the directory tree and find it.
    """
    monkeypatch.setattr("citizenship_score.lyfta_client.load_dotenv", lambda *a, **kw: None)


def _client_with_handler(handler, **kwargs):
    transport = httpx.MockTransport(handler)
    return LyftaClient(transport=transport, sleep=lambda s: None, **kwargs)


# --- auth ------------------------------------------------------------------


def test_live_client_requires_api_key(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)
    with pytest.raises(LyftaAuthError):
        LyftaClient(sandbox=False)


def test_sandbox_client_does_not_require_api_key(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)

    def handler(request):
        assert "Authorization" not in request.headers
        return httpx.Response(200, json={"workouts": [], "current_page": 1, "total_pages": 1})

    client = _client_with_handler(handler, sandbox=True)
    assert client.fetch_workouts() == []


def test_live_client_sends_bearer_header(monkeypatch):
    monkeypatch.setenv("LYFTA_API_KEY", "secret-123")

    def handler(request):
        assert request.headers["Authorization"] == "Bearer secret-123"
        return httpx.Response(200, json={"workouts": [], "current_page": 1, "total_pages": 1})

    client = _client_with_handler(handler, sandbox=False)
    client.fetch_workouts()


# --- pagination --------------------------------------------------------------


def test_pagination_collects_all_pages(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)
    pages = {
        1: {"workouts": [{"id": 1}], "current_page": 1, "total_pages": 2},
        2: {"workouts": [{"id": 2}], "current_page": 2, "total_pages": 2},
    }
    requested_pages = []

    def handler(request):
        page = int(request.url.params.get("page", "1"))
        requested_pages.append(page)
        return httpx.Response(200, json=pages[page])

    client = _client_with_handler(handler, sandbox=True)
    result = client.fetch_workouts()
    assert [w["id"] for w in result] == [1, 2]
    assert requested_pages == [1, 2]


def test_from_to_params_passed_through(monkeypatch):
    from datetime import date

    monkeypatch.delenv("LYFTA_API_KEY", raising=False)
    seen_params = {}

    def handler(request):
        seen_params.update(dict(request.url.params))
        return httpx.Response(200, json={"workouts": [], "current_page": 1, "total_pages": 1})

    client = _client_with_handler(handler, sandbox=True)
    client.fetch_workouts(date_from=date(2026, 1, 1), date_to=date(2026, 1, 31))
    assert seen_params["from"] == "2026-01-01"
    assert seen_params["to"] == "2026-01-31"


# --- backoff / retries ---------------------------------------------------


def test_retries_on_429_then_succeeds(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)
    calls = {"count": 0}

    def handler(request):
        calls["count"] += 1
        if calls["count"] < 3:
            return httpx.Response(429, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"workouts": [{"id": 1}], "current_page": 1, "total_pages": 1})

    client = _client_with_handler(handler, sandbox=True, max_retries=5)
    result = client.fetch_workouts()
    assert result == [{"id": 1}]
    assert calls["count"] == 3


def test_exhausts_retries_raises(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)

    def handler(request):
        return httpx.Response(500)

    client = _client_with_handler(handler, sandbox=True, max_retries=2)
    with pytest.raises(LyftaApiError):
        client.fetch_workouts()


def test_non_retryable_error_raises_immediately(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)
    calls = {"count": 0}

    def handler(request):
        calls["count"] += 1
        return httpx.Response(404)

    client = _client_with_handler(handler, sandbox=True, max_retries=5)
    with pytest.raises(LyftaApiError):
        client.fetch_workouts()
    assert calls["count"] == 1


# --- real sandbox fixture parses into our models --------------------------


def test_sandbox_fixture_parses_into_models(monkeypatch):
    monkeypatch.delenv("LYFTA_API_KEY", raising=False)
    raw = json.loads(FIXTURE_PATH.read_text())

    def handler(request):
        return httpx.Response(200, json=raw)

    client = _client_with_handler(handler, sandbox=True)
    workouts_raw = client.fetch_workouts()
    assert len(workouts_raw) == 2

    from citizenship_score.models import Workout

    workouts = [Workout.model_validate(w) for w in workouts_raw]
    assert workouts[0].id == "1001"
    assert workouts[0].body_weight == 82.0
    assert workouts[0].exercises[0].exercise_name == "Bench Press"
    assert workouts[0].exercises[0].sets[0].weight == 80.0
    assert workouts[0].exercises[0].sets[0].reps == 5
