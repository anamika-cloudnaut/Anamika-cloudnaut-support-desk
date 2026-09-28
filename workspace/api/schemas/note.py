from datetime import datetime

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    note: str = Field(min_length=1)
    created_by: str = Field(min_length=1)
    is_public: bool = False


class NoteResponse(BaseModel):
    id: int
    request_id: int
    note: str
    created_by: str
    created_at: datetime
    is_public: bool = False


class ProgressUpdateResponse(NoteResponse):
    ticket_title: str