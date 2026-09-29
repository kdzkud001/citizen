import uuid
from datetime import timedelta

import pytest

from app.models.habit import HabitLog
from app.models.lyfta_connection import LyftaConnection
from app.services.scoring import today_utc


def _spokes(window: dict) -> dict:
    return {s["category"]: s for s in window["spokes"]}


def _create_habit(client, headers, **body):
    resp = client.post("/habits", json={"name": "h", **body}, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


def test_wheel_requires_auth(client):
    assert client.get("/me/wheel").status_code == 401


def test_new_user_nothing_tracking(client, auth_headers):
    body = client.get("/me/wheel", headers=auth_headers).json()
    assert body["days"] == 28
    for window in ("current", "previous"):
        spokes = body[window]["spokes"]
        assert [s["category"] for s in spokes] == ["Mind", "Spirit", "Discipline", "Body", "Fitness"]
        assert all(s["tracking"] is False and s["percent"] == 0.0 for s in spokes)


def test_window_dates(client, auth_headers):
    body = client.get("/me/wheel?days=28", headers=auth_headers).json()
    today = today_utc()
    assert body["current"]["end"] == today.isoformat()
    assert body["current"]["start"] == (today - timedelta(days=27)).isoformat()
    assert body["previous"]["end"] == (today - timedelta(days=28)).isoformat()
    assert body["previous"]["start"] == (today - timedelta(days=55)).isoformat()


def test_habit_completions_fill_their_category(client, auth_headers):
    habit_id = _create_habit(client, auth_headers, category="Mind", weekly_target=7)
    today = today_utc()
    for day in (today, today - timedelta(days=1)):
        client.post(f"/habits/{habit_id}/completions", json={"completed_on": day.isoformat()}, headers=auth_headers)

    body = client.get("/me/wheel", headers=auth_headers).json()
    mind = _spokes(body["current"])["Mind"]
    assert mind["tracking"] is True
    assert mind["completions"] == 2
    assert mind["target"] == pytest.approx(28)
    assert mind["percent"] == pytest.approx(100 * 2 / 28)
    assert _spokes(body["current"])["Spirit"]["tracking"] is False
    assert _spokes(body["previous"])["Mind"]["completions"] == 0


def test_previous_window_counts_older_completions(client, auth_headers, db_session, user_id):
    habit_id = _create_habit(client, auth_headers, category="Spirit", weekly_target=7)
    # The API refuses backfill beyond yesterday, so seed an old log directly.
    db_session.add(
        HabitLog(habit_id=uuid.UUID(habit_id), user_id=user_id, completed_on=today_utc() - timedelta(days=30))
    )
    db_session.commit()

    body = client.get("/me/wheel", headers=auth_headers).json()
    assert _spokes(body["current"])["Spirit"]["completions"] == 0
    assert _spokes(body["previous"])["Spirit"]["completions"] == 1


def test_fitness_tracks_once_lyfta_connected(client, auth_headers, db_session, user_id):
    client.get("/me", headers=auth_headers)  # lazily creates the profile
    db_session.add(LyftaConnection(user_id=user_id, method="api_key", encrypted_credential="x"))
    db_session.commit()

    fitness = _spokes(client.get("/me/wheel", headers=auth_headers).json()["current"])["Fitness"]
    assert fitness["tracking"] is True
    assert fitness["target"] == pytest.approx(3 * 4)  # default weekly session target, 4 weeks


def test_custom_days(client, auth_headers):
    _create_habit(client, auth_headers, category="Body", weekly_target=7)
    body = client.get("/me/wheel?days=7", headers=auth_headers).json()
    assert body["days"] == 7
    assert _spokes(body["current"])["Body"]["target"] == pytest.approx(7)


@pytest.mark.parametrize("days", [0, 366])
def test_days_out_of_range_rejected(client, auth_headers, days):
    assert client.get(f"/me/wheel?days={days}", headers=auth_headers).status_code == 422
