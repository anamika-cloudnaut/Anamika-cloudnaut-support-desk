from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.auth as auth
from app.main import app
from database.app.database import get_db
from database.app.models import Base, SupportRequest, TeamMember, TicketNote


def test_public_progress_updates_are_limited_to_requester(monkeypatch):
    monkeypatch.setattr(auth, "JWT_SECRET", "progress-update-test-secret-32-bytes")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = session_factory()
    requester = TeamMember(
        name="Requester",
        email="requester@example.com",
        role="employee",
        is_active=True,
    )
    another_employee = TeamMember(
        name="Another Employee",
        email="another@example.com",
        role="employee",
        is_active=True,
    )
    support = TeamMember(
        name="Support Technician",
        email="support@example.com",
        role="support",
        is_active=True,
    )
    db.add_all([requester, another_employee, support])
    db.flush()
    requester_ticket = SupportRequest(
        title="Requester ticket",
        description="Request details",
        requester_name=requester.name,
        requester_email=requester.email,
        category="Access",
        priority="Low",
        status="Open",
    )
    other_ticket = SupportRequest(
        title="Other ticket",
        description="Other details",
        requester_name=another_employee.name,
        requester_email=another_employee.email,
        category="Access",
        priority="Low",
        status="Open",
    )
    db.add_all([requester_ticket, other_ticket])
    db.flush()
    db.add_all([
        TicketNote(
            request_id=requester_ticket.id,
            note="Requester-visible update",
            created_by=support.name,
            is_public=True,
        ),
        TicketNote(
            request_id=requester_ticket.id,
            note="Internal team note",
            created_by=support.name,
            is_public=False,
        ),
        TicketNote(
            request_id=other_ticket.id,
            note="Another employee update",
            created_by=support.name,
            is_public=True,
        ),
    ])
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    requester_headers = {"Authorization": f"Bearer {auth.create_access_token(requester)}"}
    support_headers = {"Authorization": f"Bearer {auth.create_access_token(support)}"}
    try:
        submitted_update = client.post(
            f"/internal/requests/{requester_ticket.id}/notes",
            headers=support_headers,
            json={"note": "Support is investigating the issue.", "is_public": True},
        )
        assert submitted_update.status_code == 201
        assert submitted_update.json()["is_public"] is True

        own_notes = client.get(
            f"/internal/requests/{requester_ticket.id}/notes",
            headers=requester_headers,
        )
        assert own_notes.status_code == 200
        assert [note["note"] for note in own_notes.json()] == [
            "Requester-visible update",
            "Support is investigating the issue.",
        ]

        dashboard_updates = client.get(
            "/internal/progress-updates",
            headers=requester_headers,
        )
        assert dashboard_updates.status_code == 200
        assert [item["note"] for item in dashboard_updates.json()] == [
            "Support is investigating the issue.",
            "Requester-visible update",
        ]
        assert dashboard_updates.json()[0]["ticket_title"] == "Requester ticket"

        other_ticket_notes = client.get(
            f"/internal/requests/{other_ticket.id}/notes",
            headers=requester_headers,
        )
        assert other_ticket_notes.status_code == 404

        support_notes = client.get(
            f"/internal/requests/{requester_ticket.id}/notes",
            headers=support_headers,
        )
        assert support_notes.status_code == 200
        assert len(support_notes.json()) == 3
    finally:
        app.dependency_overrides.clear()
        db.close()
        engine.dispose()