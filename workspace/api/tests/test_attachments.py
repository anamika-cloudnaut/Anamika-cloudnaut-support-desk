import jwt
from fastapi.testclient import TestClient

import auth
from app import app
from routers import attachments as attachment_router


client = TestClient(app)


class FakeResponse:
    status_code = 201
    headers = {"content-type": "application/json"}
    content = b""

    @staticmethod
    def json():
        return {
            "id": 1,
            "request_id": 3,
            "uploaded_by_id": 7,
            "original_filename": "photo.png",
            "content_type": "image/png",
            "size_bytes": 10,
            "created_at": "2026-09-29T10:00:00Z",
        }


class FakeAsyncClient:
    request_args = None

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def request(self, method, path, files=None, headers=None):
        FakeAsyncClient.request_args = {
            "method": method,
            "path": path,
            "files": files,
            "headers": headers,
        }
        return FakeResponse()


def test_upload_forwards_multipart_and_authorization(monkeypatch):
    secret = "attachment-api-test-secret-with-32-bytes"
    monkeypatch.setattr(auth, "JWT_SECRET", secret)
    monkeypatch.setattr(attachment_router.httpx, "AsyncClient", FakeAsyncClient)
    token = jwt.encode(
        {"sub": "7", "email": "employee@example.com", "name": "Employee", "role": "employee"},
        secret,
        algorithm="HS256",
    )

    response = client.post(
        "/requests/3/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("photo.png", b"png-bytes", "image/png")},
    )

    assert response.status_code == 201
    assert response.json()["original_filename"] == "photo.png"
    assert FakeAsyncClient.request_args["method"] == "POST"
    assert FakeAsyncClient.request_args["path"] == "/internal/requests/3/attachments"
    assert FakeAsyncClient.request_args["headers"]["Authorization"] == f"Bearer {token}"
    assert FakeAsyncClient.request_args["files"]["file"][2] == "image/png"


def test_upload_rejects_file_over_five_megabytes(monkeypatch):
    secret = "attachment-api-test-secret-with-32-bytes"
    monkeypatch.setattr(auth, "JWT_SECRET", secret)
    token = jwt.encode(
        {"sub": "7", "email": "employee@example.com", "name": "Employee", "role": "employee"},
        secret,
        algorithm="HS256",
    )

    response = client.post(
        "/requests/3/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("large.png", b"x" * (5 * 1024 * 1024 + 1), "image/png")},
    )
    assert response.status_code == 413
