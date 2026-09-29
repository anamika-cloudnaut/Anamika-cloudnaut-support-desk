from datetime import datetime

from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id: int
    request_id: int
    uploaded_by_id: int
    original_filename: str
    content_type: str
    size_bytes: int
    created_at: datetime
