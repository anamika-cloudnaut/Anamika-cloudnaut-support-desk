from enum import Enum

class RequestStatus(str, Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    BLOCKED = "Blocked"
    RESOLVED = "Resolved"

VALID_TRANSITIONS = {
    RequestStatus.OPEN: {RequestStatus.IN_PROGRESS},
    RequestStatus.IN_PROGRESS: {RequestStatus.BLOCKED, RequestStatus.RESOLVED},
    RequestStatus.BLOCKED: {RequestStatus.IN_PROGRESS, RequestStatus.RESOLVED},
    RequestStatus.RESOLVED: {RequestStatus.IN_PROGRESS},
}

def validate_status_transition(current_status: str, new_status: str) -> bool:
    """Validates whether a status transition is permitted by business rules."""
    try:
        curr_enum = RequestStatus(current_status)
        new_enum = RequestStatus(new_status)
    except ValueError:
        raise ValueError(f"Invalid status value provided.")

    if new_enum not in VALID_TRANSITIONS.get(curr_enum, set()):
        raise ValueError(f"Cannot transition status from '{current_status}' to '{new_status}'.")
    
    return True