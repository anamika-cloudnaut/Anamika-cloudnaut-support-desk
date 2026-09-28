import jwt
from fastapi.testclient import TestClient

import auth
from app import app
from routers import requests as requests_router


client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code, data):
        self.status_code = status_code
        self._data = data

    def json(self):
        return self._data


class FakeAsyncClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def request(self, method, path, params=None, json=None, headers=None):
        return FakeResponse(
            201,
            {
                "id": 1,
                "title": json["title"],
                "description": json["description"],
                "requester_name": json["requester_name"],
                "requester_email": json["requester_email"],
                "category": json["category"],
                "priority": json["priority"],
                "status": "Open",
                "assigned_to": None,
                "due_date": json.get("due_date"),
                "created_at": "2026-09-23T10:00:00Z",
                "updated_at": "2026-09-23T10:00:00Z",
            },
        )


def employee_token(monkeypatch, email="ram@example.com"):
    monkeypatch.setattr(auth, "JWT_SECRET", "test-secret-key-with-32-bytes-minimum")
    return jwt.encode(
        {"sub": "3", "email": email, "name": "Ram", "role": "employee"},
        "test-secret-key-with-32-bytes-minimum",
        algorithm="HS256",
    )


def test_create_ticket_success(monkeypatch):
    token = employee_token(monkeypatch)
    monkeypatch.setattr(requests_router.httpx, "AsyncClient", FakeAsyncClient)
    response = client.post(
        "/requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Laptop WiFi issue",
            "description": "Unable to connect to office WiFi",
            "requester_name": "Ramkrushna",
            "requester_email": "ram@example.com",
            "category": "Infrastructure",
            "priority": "High",
            "due_date": "2026-09-30",
        },
    )
    assert response.status_code == 201
    assert response.json()["id"] == 1
    assert response.json()["title"] == "Laptop WiFi issue"
    assert response.json()["status"] == "Open"


def test_create_ticket_requires_sign_in():
    response = client.post(
        "/requests",
        json={
            "title": "Laptop issue",
            "description": "Unable to connect",
            "requester_name": "Ram",
            "requester_email": "ram@example.com",
            "category": "Infrastructure",
            "priority": "High",
        },
    )
    assert response.status_code == 401


def test_employee_cannot_create_ticket_for_another_email(monkeypatch):
    token = employee_token(monkeypatch)
    response = client.post(
        "/requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Laptop issue",
            "description": "Unable to connect",
            "requester_name": "Someone else",
            "requester_email": "other@example.com",
            "category": "Infrastructure",
            "priority": "High",
        },
    )
    assert response.status_code == 403


def test_create_ticket_missing_title(monkeypatch):
    token = employee_token(monkeypatch)
    response = client.post(
        "/requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "description": "Unable to connect",
            "requester_name": "Ramkrushna",
            "requester_email": "ram@example.com",
            "category": "Infrastructure",
            "priority": "High",
        },
    )
    assert response.status_code == 422


def test_create_ticket_invalid_email(monkeypatch):
    token = employee_token(monkeypatch)
    response = client.post(
        "/requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Laptop issue",
            "description": "Unable to connect",
            "requester_name": "Ramkrushna",
            "requester_email": "wrong-email",
            "category": "Infrastructure",
            "priority": "High",
        },
    )
    assert response.status_code == 422


def test_create_ticket_invalid_category(monkeypatch):
    token = employee_token(monkeypatch)
    response = client.post(
        "/requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Laptop issue",
            "description": "Unable to connect",
            "requester_name": "Ramkrushna",
            "requester_email": "ram@example.com",
            "category": "InvalidCategory",
            "priority": "High",
        },
    )
    assert response.status_code == 422


def test_create_ticket_invalid_priority(monkeypatch):
    token = employee_token(monkeypatch)
    response = client.post(
        "/requests",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "title": "Laptop issue",
            "description": "Unable to connect",
            "requester_name": "Ramkrushna",
            "requester_email": "ram@example.com",
            "category": "Infrastructure",
            "priority": "Extreme",
        },
    )
    assert response.status_code == 422
