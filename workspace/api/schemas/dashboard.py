from pydantic import BaseModel, Field


class TrendPoint(BaseModel):
    date: str
    count: int


class DashboardSummary(BaseModel):
    total: int
    by_status: dict[str, int]
    assigned: int
    unassigned: int
    by_assignee: dict[str, int]
    by_priority: dict[str, int] = Field(default_factory=dict)
    by_category: dict[str, int] = Field(default_factory=dict)
    recent: list[TrendPoint] = Field(default_factory=list)
