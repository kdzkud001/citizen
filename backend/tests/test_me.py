def test_update_weekly_session_target(client, auth_headers):
    resp = client.patch("/me", json={"weekly_session_target": 5}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["weekly_session_target"] == 5


def test_score_for_brand_new_user_is_zero_outsider(client, auth_headers):
    resp = client.get("/me/score", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["today"]["rolling_score"] == 0.0
    assert body["today"]["class_name"] == "Outsider"
    assert body["points_to_next_class"] == 300.0
