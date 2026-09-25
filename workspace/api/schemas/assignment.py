from pydantic import BaseModel


class AssignmentRequest(BaseModel):
    assigned_to: int | None