from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database.app.database import get_db

from app.repositories.request_repository import RequestRepository
from app.services.request_service import RequestService

app = FastAPI(title="Cloudnaut Support Desk Backend Service")


@app.get("/health", status_code=status.HTTP_200_OK)
def health_check():
    return {"status": "healthy"}


@app.post("/internal/requests", status_code=status.HTTP_201_CREATED)
def create_internal_request(payload: dict, db: Session = Depends(get_db)):
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
            detail=str(err),
        )


@app.get("/internal/requests/{request_id}", status_code=status.HTTP_200_OK)
def get_internal_request(request_id: int, db: Session = Depends(get_db)):
    repository = RequestRepository(db)
    service = RequestService(repository)
    req = service.get_request_by_id(request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Request {request_id} not found",
        )
    return req