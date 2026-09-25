from pydantic import BaseModel


class DashboardSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    assigned: int
    unassigned: int
    by_assignee: dict[str, int]