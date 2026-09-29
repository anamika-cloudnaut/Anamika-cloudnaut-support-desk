import jwt
from fastapi.testclient import TestClient

import auth
from app import app
from routers import attachments as attachment_router


client = TestClient(app)


class FakeResponse:
    def __init__(self, status_code=201, data=None, headers=None, content=b""):
        self.status_code = status_code
        self._data = data
        self.headers = headers or {"content-type": "application/json"}
        self.content = content

    def json(self):
        return self._data or {
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
        if method == "DELETE":
            return FakeResponse(status_code=204, data=None, headers={})
        if method == "GET" and path.endswith("/attachments"):
            return FakeResponse(
                data=[
                    {
                        "id": 1,
                        "request_id": 3,
                        "uploaded_by_id": 7,
                        "original_filename": "photo.png",
                        "content_type": "image/png",
                        "size_bytes": 10,
                        "created_at": "2026-09-29T10:00:00Z",
                    }
                ]
            )
        if method == "GET":
            return FakeResponse(
                status_code=200,
                data=None,
                headers={"content-type": "image/png"},
                content=b"png content",
            )
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


def test_list_download_and_delete_forward_authorization(monkeypatch):
    secret = "attachment-api-test-secret-with-32-bytes"
    monkeypatch.setattr(auth, "JWT_SECRET", secret)
    monkeypatch.setattr(attachment_router.httpx, "AsyncClient", FakeAsyncClient)
    token = jwt.encode(
        {"sub": "7", "email": "employee@example.com", "name": "Employee", "role": "employee"},
        secret,
        algorithm="HS256",
    )
    headers = {"Authorization": f"Bearer {token}"}

    listed = client.get("/requests/3/attachments", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["original_filename"] == "photo.png"
    assert FakeAsyncClient.request_args["method"] == "GET"
    assert FakeAsyncClient.request_args["headers"]["Authorization"] == f"Bearer {token}"

    downloaded = client.get("/attachments/1", headers=headers)
    assert downloaded.status_code == 200
    assert downloaded.content == b"png content"
    assert downloaded.headers["content-type"] == "image/png"

    deleted = client.delete("/attachments/1", headers=headers)
    assert deleted.status_code == 204
    assert FakeAsyncClient.request_args["method"] == "DELETE"
    assert FakeAsyncClient.request_args["path"] == "/internal/attachments/1"


def test_attachment_routes_require_authentication():
    assert client.get("/requests/3/attachments").status_code == 401
    assert client.get("/attachments/1").status_code == 401
    assert client.delete("/attachments/1").status_code == 401
