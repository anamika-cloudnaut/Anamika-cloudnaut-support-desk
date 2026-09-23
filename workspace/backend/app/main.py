from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.services.request_service import RequestService

app = FastAPI(title="Backend Service", version="1.0.0")
request_service = RequestService()

class CreateRequestSchema(BaseModel):
    title: str
    description: str
    requester_name: str
    requester_email: EmailStr
    category: str
    priority: str
    due_date: Optional[str] = None

@app.post("/internal/requests", status_code=status.HTTP_201_CREATED)
def create_internal_request(payload: CreateRequestSchema):
    try:
        result = request_service.create_request(
            title=payload.title,
            description=payload.description,
            requester_name=payload.requester_name,
            requester_email=payload.requester_email,
            category=payload.category,
            priority=payload.priority,
            due_date=payload.due_date
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error")