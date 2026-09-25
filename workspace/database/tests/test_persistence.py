import pytest
from database.app.models import TeamMember, SupportRequest, HistoryEvent, TicketNote


def test_create_team_member(db_session):
    """Test creating and querying a team member."""
    member = TeamMember(name="Anita Desai", email="anita@cloudnaut.com", is_active=True)
    db_session.add(member)
    db_session.commit()

    saved = db_session.query(TeamMember).filter_by(email="anita@cloudnaut.com").first()
    assert saved is not None
    assert saved.name == "Anita Desai"
    assert saved.is_active is True


def test_create_support_request_default_status(db_session):
    """Test default values on new support request."""
    req = SupportRequest(
        title="Software License Required",
        description="Need license for Docker Desktop",
        requester_name="Yogesh ",
        requester_email="yogicloudnaut.com",
        category="Access",
        priority="Medium",
    )
    db_session.add(req)
    db_session.commit()

    saved = db_session.query(SupportRequest).filter_by(title="Software License Required").first()
    assert saved is not None
    assert saved.status == "Open"
    assert saved.assigned_to is None


def test_request_assignment_relationship(db_session):
    """Test assigning a support request to a team member."""
    member = TeamMember(name="Vikram Seth", email="vikram@cloudnaut.com", is_active=True)
    db_session.add(member)
    db_session.commit()

    req = SupportRequest(
        title="Database Slowdown",
        description="Queries taking > 5 seconds",
        requester_name="DevOps Team",
        requester_email="devops@cloudnaut.com",
        category="Data",
        priority="High",
        assigned_to=member.id,
    )
    db_session.add(req)
    db_session.commit()

    saved_req = db_session.query(SupportRequest).filter_by(title="Database Slowdown").first()
    assert saved_req.assignee is not None
    assert saved_req.assignee.name == "Vikram Seth"


def test_ticket_note_relationship(db_session):
    req = SupportRequest(
        title="Cannot access dashboard",
        description="Dashboard returns an error",
        requester_name="Support",
        requester_email="support@cloudnaut.com",
        category="Application",
        priority="High",
    )
    db_session.add(req)
    db_session.commit()

    note = TicketNote(request_id=req.id, body="Investigating the dashboard error")
    db_session.add(note)
    db_session.commit()

    saved = db_session.query(TicketNote).filter_by(request_id=req.id).one()
    assert saved.request.title == "Cannot access dashboard"
    assert saved.body == "Investigating the dashboard error"