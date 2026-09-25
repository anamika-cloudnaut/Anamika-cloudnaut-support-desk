from enum import Enum

from pydantic import BaseModel


class RequestStatus(str, Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    BLOCKED = "Blocked"
    RESOLVED = "Resolved"


class StatusUpdate(BaseModel):
    status: RequestStatus