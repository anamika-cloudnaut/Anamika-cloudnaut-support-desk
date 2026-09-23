from fastapi.testclient import TestClient

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

    async def post(self, path, json):
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


def test_create_ticket_success(monkeypatch):
    monkeypatch.setattr(
        requests_router.httpx,
        "AsyncClient",
        FakeAsyncClient,
    )

    response = client.post(
        "/requests",
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

    body = response.json()

    assert body["id"] == 1
    assert body["title"] == "Laptop WiFi issue"
    assert body["status"] == "Open"


def test_create_ticket_missing_title():
    response = client.post(
        "/requests",
        json={
            "description": "Unable to connect",
            "requester_name": "Ramkrushna",
            "requester_email": "ram@example.com",
            "category": "Infrastructure",
            "priority": "High",
        },
    )

    assert response.status_code == 422


def test_create_ticket_invalid_email():
    response = client.post(
        "/requests",
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


def test_create_ticket_invalid_category():
    response = client.post(
        "/requests",
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


def test_create_ticket_invalid_priority():
    response = client.post(
        "/requests",
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
