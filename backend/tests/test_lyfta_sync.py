"""
Mocks the Lyfta API via httpx.MockTransport (LyftaClient already accepts a
`transport` override, so no extra mocking library is needed) rather than
hitting the real endpoint.
"""

from __future__ import annotations

import functools
from datetime import date

import httpx
import pytest
from sqlalchemy import select

from citizenship_score.lyfta_client import LyftaClient

from app.models.workout import WorkoutRecord
from app.services import lyfta_sync as lyfta_sync_module

RAW_WORKOUT = {
    "id": "1",
    "title": "Leg Day",
    "body_weight": "80",
    "workout_perform_date": "2026-01-10",
    "total_volume": "0",
    "exercises": [
        {
            "exercise_id": "1",
            "excercise_name": "Squat",
            "exercise_type": "weight_reps",
            "sets": [
                {
                    "weight": "100",
                    "reps": "10",
                    "rir": "2",
                    "duration": "",
                    "distance": "",
                    "set_type_id": "0",
                    "is_completed": True,
                    "record_type": None,
                }
            ],
        }
    ],
}


def _handler_for(workouts: list[dict]):
    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers.get("Authorization") != "Bearer valid-key":
            return httpx.Response(401, json={"error": "unauthorized"})
        return httpx.Response(
            200,
            json={
                "workouts": workouts,
                "current_page": 1,
                "total_pages": 1,
                "count": len(workouts),
                "total_records": len(workouts),
                "limit": 50,
            },
        )

    return handler


@pytest.fixture
def mock_lyfta(monkeypatch):
    def _install(workouts: list[dict]):
        transport = httpx.MockTransport(_handler_for(workouts))
        monkeypatch.setattr(
            lyfta_sync_module, "LyftaClient", functools.partial(LyftaClient, transport=transport)
        )

    return _install


def test_connect_rejects_invalid_key(client, auth_headers, mock_lyfta):
    mock_lyfta([])
    resp = client.post("/me/lyfta", json={"api_key": "bad-key"}, headers=auth_headers)
    assert resp.status_code == 400


def test_connect_accepts_valid_key(client, auth_headers, mock_lyfta):
    mock_lyfta([])
    resp = client.post("/me/lyfta", json={"api_key": "valid-key"}, headers=auth_headers)
    assert resp.status_code == 204


def test_sync_upserts_without_duplicates(client, auth_headers, mock_lyfta, db_session, user_id):
    mock_lyfta([RAW_WORKOUT])
    connect = client.post("/me/lyfta", json={"api_key": "valid-key"}, headers=auth_headers)
    assert connect.status_code == 204

    first = client.post("/me/lyfta/sync", headers=auth_headers)
    assert first.status_code == 200
    assert first.json()["synced_count"] == 1

    second = client.post("/me/lyfta/sync", headers=auth_headers)
    assert second.status_code == 200

    rows = list(db_session.scalars(select(WorkoutRecord).where(WorkoutRecord.user_id == user_id)))
    assert len(rows) == 1
    assert rows[0].lyfta_workout_id == "1"


def test_sync_recomputes_scores(client, auth_headers, mock_lyfta):
    # /me/score's history is windowed to the trailing 28 days from today, so
    # the workout has to be dated within that window regardless of when this
    # test runs -- a fixed historical date would silently fall outside it.
    today = date.today().isoformat()
    workout_today = {**RAW_WORKOUT, "workout_perform_date": today}
    mock_lyfta([workout_today])
    client.post("/me/lyfta", json={"api_key": "valid-key"}, headers=auth_headers)
    client.post("/me/lyfta/sync", headers=auth_headers)

    score = client.get("/me/score", headers=auth_headers).json()
    history_dates = {row["date"]: row for row in score["history"]}
    assert today in history_dates
    assert history_dates[today]["workout_points"] > 0


def test_disconnect_then_sync_fails(client, auth_headers, mock_lyfta):
    mock_lyfta([])
    client.post("/me/lyfta", json={"api_key": "valid-key"}, headers=auth_headers)
    disconnect = client.delete("/me/lyfta", headers=auth_headers)
    assert disconnect.status_code == 204

    resp = client.post("/me/lyfta/sync", headers=auth_headers)
    assert resp.status_code == 400
