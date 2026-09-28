from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.auth as auth
from app.main import app
from database.app.database import get_db
from database.app.models import AccessRequest, Base, TeamMember


def test_signup_request_requires_admin_approval_before_login(monkeypatch):
    monkeypatch.setattr(auth, "JWT_SECRET", "access-request-test-secret-with-32-bytes")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_factory()
    admin = TeamMember(
        name="Administrator",
        email="admin@example.com",
        role="admin",
        password_hash=auth.hash_password("AdminPass6"),
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    admin_headers = {"Authorization": f"Bearer {auth.create_access_token(admin)}"}
    try:
        payload = {
            "name": "New Staff",
            "email": "new-staff@example.com",
            "password": "Staff6x",
            "role": "employee",
            "message": "Requesting access",
        }
        submitted = client.post("/internal/access-requests", json=payload)
        assert submitted.status_code == 201
        assert submitted.json()["status"] == "pending"
        assert "password_hash" not in submitted.json()
        assert client.post(
            "/internal/auth/login",
            json={"email": payload["email"], "password": payload["password"]},
        ).status_code == 401

        listing = client.get("/internal/access-requests", headers=admin_headers)
        assert listing.status_code == 200
        request_id = listing.json()[0]["id"]
        approved = client.patch(
            f"/internal/access-requests/{request_id}",
            headers=admin_headers,
            json={"status": "approved"},
        )
        assert approved.status_code == 200
        assert approved.json()["status"] == "approved"
        login = client.post(
            "/internal/auth/login",
            json={"email": payload["email"], "password": payload["password"]},
        )
        assert login.status_code == 200
        assert login.json()["user"]["role"] == "employee"

        admin_signup = client.post(
            "/internal/access-requests",
            json={**payload, "email": "self-admin@example.com", "role": "admin"},
        )
        assert admin_signup.status_code == 400
        assert db.query(AccessRequest).filter_by(id=request_id).one().password_hash
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()