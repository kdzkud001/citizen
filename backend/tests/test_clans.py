def test_create_clan_auto_joins_owner(client, auth_headers):
    resp = client.post("/clans", json={"name": "Iron Legion"}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Iron Legion"
    assert body["is_owner"] is True
    assert len(body["members"]) == 1
    assert set(body["members"][0].keys()) == {"display_name", "rolling_score", "class_name"}


def test_is_owner_false_for_non_owner_member(client, auth_headers, other_auth_headers):
    created = client.post("/clans", json={"name": "Iron Legion"}, headers=auth_headers).json()
    joined = client.post(
        "/clans/join", json={"invite_code": created["invite_code"]}, headers=other_auth_headers
    ).json()
    assert joined["is_owner"] is False

    owner_view = client.get("/clans/me", headers=auth_headers).json()
    assert owner_view["is_owner"] is True


def test_join_by_invite_code(client, auth_headers, other_auth_headers):
    created = client.post("/clans", json={"name": "Iron Legion"}, headers=auth_headers).json()
    resp = client.post(
        "/clans/join", json={"invite_code": created["invite_code"]}, headers=other_auth_headers
    )
    assert resp.status_code == 200
    assert len(resp.json()["members"]) == 2


def test_cannot_join_two_clans(client, auth_headers, other_auth_headers):
    clan_a = client.post("/clans", json={"name": "A"}, headers=auth_headers).json()
    client.post("/clans", json={"name": "B"}, headers=other_auth_headers)

    resp = client.post(
        "/clans/join", json={"invite_code": clan_a["invite_code"]}, headers=other_auth_headers
    )
    assert resp.status_code == 409


def test_leave_and_rejoin(client, auth_headers, other_auth_headers):
    created = client.post("/clans", json={"name": "Iron Legion"}, headers=auth_headers).json()
    client.post("/clans/join", json={"invite_code": created["invite_code"]}, headers=other_auth_headers)

    leave_resp = client.post("/clans/leave", headers=other_auth_headers)
    assert leave_resp.status_code == 204

    not_a_member = client.get("/clans/me", headers=other_auth_headers)
    assert not_a_member.status_code == 404

    rejoin = client.post(
        "/clans/join", json={"invite_code": created["invite_code"]}, headers=other_auth_headers
    )
    assert rejoin.status_code == 200


def test_only_owner_can_regenerate_invite_code(client, auth_headers, other_auth_headers):
    created = client.post("/clans", json={"name": "Iron Legion"}, headers=auth_headers).json()
    client.post("/clans/join", json={"invite_code": created["invite_code"]}, headers=other_auth_headers)

    forbidden = client.post("/clans/regenerate-code", headers=other_auth_headers)
    assert forbidden.status_code == 403

    allowed = client.post("/clans/regenerate-code", headers=auth_headers)
    assert allowed.status_code == 200
    assert allowed.json()["invite_code"] != created["invite_code"]


def test_leaderboard_never_exposes_raw_workout_or_lyfta_fields(client, auth_headers, other_auth_headers):
    created = client.post("/clans", json={"name": "Iron Legion"}, headers=auth_headers).json()
    client.post("/clans/join", json={"invite_code": created["invite_code"]}, headers=other_auth_headers)

    body = client.get("/clans/me", headers=auth_headers).json()
    for member in body["members"]:
        assert set(member.keys()) == {"display_name", "rolling_score", "class_name"}
    assert set(body.keys()) == {
        "id",
        "name",
        "invite_code",
        "clan_score",
        "participation",
        "is_owner",
        "members",
    }
