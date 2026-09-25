from types import SimpleNamespace

import pytest

from app.services.request_service import RequestService


class FakeRepository:
    def __init__(self):
        self.request = SimpleNamespace(id=1, title="Old title")
        self.members = [
            SimpleNamespace(id=2, name="Active", email="active@example.com", is_active=True)
        ]

    def get_request_by_id(self, request_id):
        return self.request if request_id == 1 else None

    def update_request(self, request, fields):
        for key, value in fields.items():
            setattr(request, key, value)
        return request

    def list_team_members(self, active_only):
        return self.members


def test_update_request_changes_editable_fields():
    request = RequestService(FakeRepository()).update_request(
        1, {"title": "New title"}
    )
    assert request.title == "New title"


def test_update_request_rejects_system_fields():
    with pytest.raises(ValueError, match="Unsupported"):
        RequestService(FakeRepository()).update_request(1, {"status": "Resolved"})


def test_team_member_listing_is_available():
    members = RequestService(FakeRepository()).list_team_members(active_only=True)
    assert members[0].is_active is True
