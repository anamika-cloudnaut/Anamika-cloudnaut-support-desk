from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Category(str, Enum):
    APPLICATION = "Application"
    ACCESS = "Access"
    INFRASTRUCTURE = "Infrastructure"
    DATA = "Data"
    OTHER = "Other"


class Priority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    requester_name: str = Field(min_length=1, max_length=100)
    requester_email: EmailStr
    category: Category
    priority: Priority
    due_date: date | None = None


class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=5000)
    requester_name: str | None = Field(default=None, min_length=1, max_length=100)
    requester_email: EmailStr | None = None
    category: Category | None = None
    priority: Priority | None = None
    due_date: date | None = None


class TicketResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int
    title: str
    description: str
    requester_name: str
    requester_email: EmailStr
    category: Category
    priority: Priority
    status: str
    assigned_to: int | None = None
    due_date: date | None = None
    created_at: datetime
    updated_at: datetime
