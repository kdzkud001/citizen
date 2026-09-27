def test_health_requires_no_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_me_rejects_missing_token(client):
    resp = client.get("/me")
    assert resp.status_code == 401


def test_me_rejects_garbage_token(client):
    resp = client.get("/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_me_rejects_expired_token(client, user_id, token_factory):
    expired = token_factory(user_id, exp_delta=None)
    resp = client.get("/me", headers={"Authorization": f"Bearer {expired}"})
    assert resp.status_code == 401


def test_me_accepts_valid_token_and_lazily_creates_profile(client, auth_headers, user_id):
    resp = client.get("/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(user_id)
    assert body["weekly_session_target"] == 3
