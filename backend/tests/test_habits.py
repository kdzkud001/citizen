from datetime import date, timedelta


def _create_habit(client, headers, name="Meditate"):
    resp = client.post("/habits", json={"name": name}, headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


def test_list_habits_reflects_completion_state(client, auth_headers):
    habit_id = _create_habit(client, auth_headers)

    before = client.get("/habits", headers=auth_headers).json()
    assert before[0]["completed_on_date"] is False

    client.post(
        f"/habits/{habit_id}/completions",
        json={"completed_on": date.today().isoformat()},
        headers=auth_headers,
    )

    after = client.get("/habits", headers=auth_headers).json()
    assert after[0]["completed_on_date"] is True

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    for_yesterday = client.get(f"/habits?for_date={yesterday}", headers=auth_headers).json()
    assert for_yesterday[0]["completed_on_date"] is False


def test_list_habits_rejects_dates_beyond_yesterday(client, auth_headers):
    _create_habit(client, auth_headers)
    two_days_ago = (date.today() - timedelta(days=2)).isoformat()
    resp = client.get(f"/habits?for_date={two_days_ago}", headers=auth_headers)
    assert resp.status_code == 400


def test_log_completion_today_scores_points(client, auth_headers):
    habit_id = _create_habit(client, auth_headers)
    resp = client.post(
        f"/habits/{habit_id}/completions",
        json={"completed_on": date.today().isoformat()},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    score = client.get("/me/score", headers=auth_headers).json()
    assert score["today"]["habit_points"] == 10.0
    assert score["today"]["rolling_score"] == 10.0


def test_log_completion_yesterday_is_allowed(client, auth_headers):
    habit_id = _create_habit(client, auth_headers)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    resp = client.post(
        f"/habits/{habit_id}/completions", json={"completed_on": yesterday}, headers=auth_headers
    )
    assert resp.status_code == 204


def test_log_completion_backfill_beyond_yesterday_rejected(client, auth_headers):
    habit_id = _create_habit(client, auth_headers)
    two_days_ago = (date.today() - timedelta(days=2)).isoformat()
    resp = client.post(
        f"/habits/{habit_id}/completions", json={"completed_on": two_days_ago}, headers=auth_headers
    )
    assert resp.status_code == 400


def test_duplicate_completion_is_idempotent(client, auth_headers):
    habit_id = _create_habit(client, auth_headers)
    today = date.today().isoformat()
    first = client.post(f"/habits/{habit_id}/completions", json={"completed_on": today}, headers=auth_headers)
    second = client.post(f"/habits/{habit_id}/completions", json={"completed_on": today}, headers=auth_headers)
    assert first.status_code == 204
    assert second.status_code == 204

    score = client.get("/me/score", headers=auth_headers).json()
    assert score["today"]["habit_points"] == 10.0  # not doubled


def test_cannot_log_completion_on_another_users_habit(client, auth_headers, other_auth_headers):
    habit_id = _create_habit(client, auth_headers)
    resp = client.post(
        f"/habits/{habit_id}/completions",
        json={"completed_on": date.today().isoformat()},
        headers=other_auth_headers,
    )
    assert resp.status_code == 404


def test_cannot_update_another_users_habit(client, auth_headers, other_auth_headers):
    habit_id = _create_habit(client, auth_headers)
    resp = client.patch(f"/habits/{habit_id}", json={"active": False}, headers=other_auth_headers)
    assert resp.status_code == 404


def test_list_habits_only_returns_own(client, auth_headers, other_auth_headers):
    _create_habit(client, auth_headers, name="Mine")
    _create_habit(client, other_auth_headers, name="Theirs")

    mine = client.get("/habits", headers=auth_headers).json()
    assert [h["name"] for h in mine] == ["Mine"]
