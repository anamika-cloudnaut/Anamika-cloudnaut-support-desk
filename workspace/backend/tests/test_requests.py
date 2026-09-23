def valid_payload(**overrides):
    payload = {
        "title": "VPN will not connect",
        "description": "Cannot reach internal network from home",
        "requester_name": "Priya Sharma",
        "requester_email": "priya@cloudnaut.example",
        "category": "Access",
        "priority": "High",
    }
    payload.update(overrides)
    return payload


def test_health_check(api_client):
    response = api_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_request_valid(api_client):
    response = api_client.post("/requests", json=valid_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "VPN will not connect"
    assert body["status"] == "Open"
    assert "id" in body


def test_create_request_missing_title(api_client):
    payload = valid_payload()
    del payload["title"]
    response = api_client.post("/requests", json=payload)
    assert response.status_code == 422


def test_create_request_invalid_email(api_client):
    response = api_client.post("/requests", json=valid_payload(requester_email="not-an-email"))
    assert response.status_code == 422


def test_create_request_invalid_category(api_client):
    response = api_client.post("/requests", json=valid_payload(category="NotReal"))
    assert response.status_code == 422


def test_get_request_not_found(api_client):
    response = api_client.get("/requests/999999")
    assert response.status_code == 404