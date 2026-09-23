import pytest
from backend.app.services.status_service import validate_status_transition

def test_valid_transitions():
    assert validate_status_transition("Open", "In Progress") is True
    assert validate_status_transition("In Progress", "Resolved") is True

def test_invalid_transitions():
    with pytest.raises(ValueError):
        validate_status_transition("Open", "Resolved")

    with pytest.raises(ValueError):
        validate_status_transition("Open", "Blocked")