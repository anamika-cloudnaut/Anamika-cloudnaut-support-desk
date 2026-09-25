from datetime import datetime

from pydantic import BaseModel


class HistoryResponse(BaseModel):
    id: int
    request_id: int
    event_type: str
    description: str
    created_at: datetime