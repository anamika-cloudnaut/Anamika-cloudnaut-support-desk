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


def create_ticket_for_note_test(db_session):
    request = SupportRequest(
        title="VPN Issue",
        description="Unable to access the internal network",
        requester_name="Alex",
        requester_email="alex@example.com",
        category="Access",
        priority="High",
    )
    db_session.add(request)
    db_session.commit()
    return request


def test_create_ticket_note(db_session):
    request = create_ticket_for_note_test(db_session)
    note = TicketNote(
        request_id=request.id,
        note="Checked VPN configuration and started investigation",
        created_by="Rahul Verma",
    )
    db_session.add(note)
    db_session.commit()

    saved = db_session.query(TicketNote).filter_by(request_id=request.id).one()
    assert saved.note == "Checked VPN configuration and started investigation"
    assert saved.created_by == "Rahul Verma"


def test_ticket_note_relationship(db_session):
    request = create_ticket_for_note_test(db_session)
    request.notes.append(TicketNote(note="Initial investigation", created_by="Rahul Verma"))
    db_session.commit()

    saved_request = db_session.query(SupportRequest).filter_by(id=request.id).one()
    assert len(saved_request.notes) == 1
    assert saved_request.notes[0].note == "Initial investigation"


def test_ticket_note_cascade_delete(db_session):
    request = create_ticket_for_note_test(db_session)
    request.notes.append(TicketNote(note="Initial investigation"))
    db_session.commit()
    request_id = request.id

    db_session.delete(request)
    db_session.commit()

    assert db_session.query(TicketNote).filter_by(request_id=request_id).count() == 0