from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.auth as auth
import app.main as backend_main
from app.auth import create_access_token
from app.routers import attachments as attachment_router
from app.services.attachment_service import AttachmentService
from app.services.object_storage import ObjectStorage, ObjectStorageError
from database.app.database import get_db
from database.app.models import Base, RequestAttachment, SupportRequest, TeamMember


class MemoryStorage:
    def __init__(self):
        self.objects = {}
        self.deleted = []

    def ensure_bucket(self):
        pass

    def upload(self, object_key, content, content_type):
        self.objects[object_key] = (content, content_type)

    def download(self, object_key):
        return self.objects[object_key][0]

    def delete(self, object_key):
        self.deleted.append(object_key)
        self.objects.pop(object_key, None)


def png_bytes():
    image = Image.new("RGB", (2, 2), color="blue")
    content = BytesIO()
    image.save(content, format="PNG")
    return content.getvalue()


@pytest.fixture
def attachment_setup(monkeypatch):
    monkeypatch.setattr(auth, "JWT_SECRET", "attachment-test-secret-with-32-bytes")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_factory()
    owner = TeamMember(
        name="Request Owner",
        email="owner@example.com",
        role="employee",
        is_active=True,
    )
    other = TeamMember(
        name="Other Employee",
        email="other@example.com",
        role="employee",
        is_active=True,
    )
    db.add_all([owner, other])
    db.flush()
    db.add_all(
        [
            SupportRequest(
                title="Owner ticket",
                description="Description",
                requester_name=owner.name,
                requester_email=owner.email,
                category="Access",
                priority="Low",
                status="Open",
            ),
            SupportRequest(
                title="Other ticket",
                description="Description",
                requester_name=other.name,
                requester_email=other.email,
                category="Access",
                priority="Low",
                status="Open",
            ),
        ]
    )
    db.commit()

    def override_get_db():
        yield db

    backend_main.app.dependency_overrides[get_db] = override_get_db
    storage = MemoryStorage()
    monkeypatch.setattr(
        attachment_router,
        "get_attachment_service",
        lambda session: AttachmentService(session, storage),
    )
    client = TestClient(backend_main.app)
    headers = {
        "Authorization": f"Bearer {create_access_token(owner)}",
    }

    yield client, db, storage, headers

    backend_main.app.dependency_overrides.clear()
    db.close()
    engine.dispose()


def test_upload_list_and_download_attachment(attachment_setup):
    client, _, storage, headers = attachment_setup
    content = png_bytes()

    uploaded = client.post(
        "/internal/requests/1/attachments",
        headers=headers,
        files={"file": ("photo.png", content, "image/png")},
    )
    assert uploaded.status_code == 201
    metadata = uploaded.json()
    assert metadata["request_id"] == 1
    assert metadata["original_filename"] == "photo.png"
    assert metadata["size_bytes"] == len(content)
    assert "object_key" not in metadata

    object_key = next(iter(storage.objects))
    assert object_key.startswith("requests/1/")

    listed = client.get("/internal/requests/1/attachments", headers=headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [metadata["id"]]

    downloaded = client.get(
        f"/internal/attachments/{metadata['id']}",
        headers=headers,
    )
    assert downloaded.status_code == 200
    assert downloaded.headers["content-type"] == "image/png"
    assert downloaded.content == content


def test_attachment_access_is_limited_to_request_owner(attachment_setup):
    client, _, storage, headers = attachment_setup
    response = client.get("/internal/requests/2/attachments", headers=headers)
    assert response.status_code == 404

    upload = client.post(
        "/internal/requests/2/attachments",
        headers=headers,
        files={"file": ("photo.png", png_bytes(), "image/png")},
    )
    assert upload.status_code == 404
    assert storage.objects == {}


def test_upload_requires_an_existing_request(attachment_setup):
    client, _, storage, headers = attachment_setup
    response = client.post(
        "/internal/requests/999/attachments",
        headers=headers,
        files={"file": ("photo.png", png_bytes(), "image/png")},
    )
    assert response.status_code == 404
    assert storage.objects == {}


@pytest.mark.parametrize(
    ("filename", "content", "content_type", "expected_status"),
    [
        ("empty.png", b"", "image/png", 400),
        ("text.txt", b"plain text", "text/plain", 415),
        ("fake.png", b"not an image", "image/png", 400),
        ("large.png", b"x" * (5 * 1024 * 1024 + 1), "image/png", 413),
    ],
)
def test_invalid_attachments_are_rejected(
    attachment_setup, filename, content, content_type, expected_status
):
    client, _, storage, headers = attachment_setup
    response = client.post(
        "/internal/requests/1/attachments",
        headers=headers,
        files={"file": (filename, content, content_type)},
    )
    assert response.status_code == expected_status
    assert storage.objects == {}


def test_upload_cleans_up_object_when_database_commit_fails(
    attachment_setup, monkeypatch
):
    client, db, storage, headers = attachment_setup

    def fail_commit():
        raise SQLAlchemyError("database unavailable")

    monkeypatch.setattr(db, "commit", fail_commit)
    response = client.post(
        "/internal/requests/1/attachments",
        headers=headers,
        files={"file": ("photo.png", png_bytes(), "image/png")},
    )
    assert response.status_code == 500
    assert storage.deleted
    assert storage.objects == {}


def test_minio_unavailable_does_not_create_metadata(attachment_setup, monkeypatch):
    client, db, _, headers = attachment_setup

    class UnavailableStorage(MemoryStorage):
        def ensure_bucket(self):
            raise OSError("MinIO is unavailable")

    storage = UnavailableStorage()
    monkeypatch.setattr(
        attachment_router,
        "get_attachment_service",
        lambda session: AttachmentService(session, storage),
    )
    response = client.post(
        "/internal/requests/1/attachments",
        headers=headers,
        files={"file": ("photo.png", png_bytes(), "image/png")},
    )
    assert response.status_code == 503
    assert db.query(RequestAttachment).count() == 0


def test_minio_connection_errors_are_reported_as_storage_errors():
    from urllib3.exceptions import MaxRetryError

    class UnreachableMinio:
        def bucket_exists(self, bucket):
            raise MaxRetryError(None, "http://minio:9000", OSError("unavailable"))

    storage = ObjectStorage.__new__(ObjectStorage)
    storage.bucket = "support-attachments"
    storage.client = UnreachableMinio()

    with pytest.raises(ObjectStorageError):
        storage.ensure_bucket()


def test_attachment_routes_require_authentication(attachment_setup):
    client, _, _, _ = attachment_setup
    response = client.get("/internal/requests/1/attachments")
    assert response.status_code == 401
