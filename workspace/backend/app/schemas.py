from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

ALLOWED_CATEGORIES = {"Application", "Access", "Infrastructure", "Data", "Other"}
ALLOWED_PRIORITIES = {"Low", "Medium", "High", "Critical"}


class SupportRequestCreate(BaseModel):
    title: str
    description: str
    requester_name: str
    requester_email: EmailStr
    category: str
    priority: str
    assigned_to: Optional[int] = None

    @field_validator("title", "description", "requester_name")
    @classmethod
    def not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("This field cannot be empty")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v):
        if v not in ALLOWED_CATEGORIES:
            raise ValueError(f"category must be one of {ALLOWED_CATEGORIES}")
        return v

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v):
        if v not in ALLOWED_PRIORITIES:
            raise ValueError(f"priority must be one of {ALLOWED_PRIORITIES}")
        return v


class SupportRequestOut(BaseModel):
    id: int
    title: str
    description: str
    requester_name: str
    requester_email: str
    category: str
    priority: str
    status: str
    assigned_to: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True