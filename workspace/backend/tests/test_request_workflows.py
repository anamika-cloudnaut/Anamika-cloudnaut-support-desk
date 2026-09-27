from types import SimpleNamespace

import pytest

from app.services.request_service import RequestService
from app.services.history_service import HistoryService


class FakeRepository:
    def __init__(self):
        self.request = SimpleNamespace(id=1, status="Open", assigned_to=None)
        self.member = SimpleNamespace(id=7, is_active=True)

    def get_request_by_id(self, request_id):
        return self.request if request_id == 1 else None

    def get_team_member(self, member_id):
        return self.member if member_id == 7 else None

    def assign_request(self, request, assignee):
        request.assignee = assignee
        request.assigned_to = assignee.id if assignee else None
        return request

    def update_status(self, request, new_status):
        request.status = new_status
        return request

    def list_requests(self, **filters):
        return [filters]


def test_assignment_requires_active_existing_member():
    service = RequestService(FakeRepository())

    result = service.assign_request(1, 7)

    assert result.assigned_to == 7


def test_status_transition_uses_business_rules():
    service = RequestService(FakeRepository())

    result = service.transition_status(1, "In Progress")

    assert result.status == "In Progress"


def test_status_transition_rejects_invalid_change():
    service = RequestService(FakeRepository())

    with pytest.raises(ValueError, match="Cannot transition"):
        service.transition_status(1, "Resolved")


def test_status_transition_returns_updated_ticket_fields():
    class StatusRepository(FakeRepository):
        def update_status(self, request, new_status):
            request.status = new_status
            return {
                "id": request.id,
                "title": "VPN Issue",
                "description": "Unable to connect",
                "requester_name": "Alex",
                "requester_email": "alex@example.com",
                "category": "Access",
                "priority": "High",
                "status": request.status,
                "assigned_to": request.assigned_to,
                "due_date": None,
                "created_at": "2026-09-25T10:00:00",
                "updated_at": "2026-09-25T10:05:00",
            }

    result = RequestService(StatusRepository()).transition_status(1, "In Progress")

    assert result["id"] == 1
    assert result["status"] == "In Progress"
    assert result["created_at"] is not None


def test_list_requests_has_safe_default_sorting():
    result = RequestService(FakeRepository()).list_requests(status="Open")

    assert result[0]["sort_by"] == "created_at"
    assert result[0]["sort_order"] == "desc"


def test_added_note_returns_api_response_fields():
    expected = {
        "id": 1,
        "request_id": 1,
        "note": "Investigating the issue",
        "created_by": "Rahul Verma",
        "created_at": "2026-09-25T10:00:00",
    }

    class NoteRepository:
        def add_note(self, request_id, note, created_by):
            return expected

    result = HistoryService(NoteRepository()).add_note(
        1, "Investigating the issue", "Rahul Verma"
    )

    assert result == expected
