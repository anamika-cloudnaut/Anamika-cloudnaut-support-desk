from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Any, Dict

from database.app.database import get_db, engine
from database.app.models import Base  # Real Base containing the models

# Create all tables using the shared Base metadata
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cloudnaut Support Desk Backend Service")


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {"status": "healthy", "service": "support-desk-backend"}


@app.post("/internal/requests", status_code=status.HTTP_201_CREATED)
def create_internal_request(payload: Dict[str, Any], db: Session = Depends(get_db)):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    try:
        repository = RequestRepository(db)
        service = RequestService(repository)
        return service.create_request(payload)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error: {str(err)}",
        )


@app.get("/internal/requests/{request_id}", status_code=status.HTTP_200_OK)
def get_internal_request(request_id: int, db: Session = Depends(get_db)):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    repository = RequestRepository(db)
    service = RequestService(repository)
    req = service.get_request_by_id(request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request {request_id} not found",
        )
    return req


@app.patch("/internal/requests/{request_id}", status_code=status.HTTP_200_OK)
def update_internal_request(
    request_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    try:
        repository = RequestRepository(db)
        return RequestService(repository).update_request(request_id, payload)
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.get("/internal/team-members", status_code=status.HTTP_200_OK)
def list_internal_team_members(
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    return [
        {
            "id": member.id,
            "name": member.name,
            "email": member.email,
            "is_active": member.is_active,
        }
        for member in RequestService(RequestRepository(db)).list_team_members(active_only)
    ]