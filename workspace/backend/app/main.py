from fastapi import FastAPI, Depends, HTTPException, Query, status
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
        result = service.create_request(payload)
        repository.add_history_event(
            result["id"],
            "created",
            f"Request created by {result['requester_name']}",
        )
        return result
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
    try:
        req = service.get_request_by_id(request_id)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    if not req:
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
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


@app.get("/internal/requests", status_code=status.HTTP_200_OK)
def list_internal_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    assigned_to: int | None = None,
    category: str | None = None,
    priority: str | None = None,
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    try:
        return RequestService(RequestRepository(db)).list_requests(
            status=status_filter,
            assigned_to=assigned_to,
            category=category,
            priority=priority,
            sort_by=sort_by,
            sort_order=sort_order,
        )
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.patch("/internal/requests/{request_id}/assignment", status_code=status.HTTP_200_OK)
def assign_internal_request(
    request_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    try:
        repository = RequestRepository(db)
        service = RequestService(repository)
        result = service.assign_request(request_id, payload.get("assigned_to"))
        repository.add_history_event(
            request_id,
            "assignment",
            "Request unassigned"
            if result.assigned_to is None
            else f"Request assigned to team member {result.assigned_to}",
        )
        return result
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.patch("/internal/requests/{request_id}/status", status_code=status.HTTP_200_OK)
def transition_internal_request(
    request_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService

    new_status = payload.get("status")
    if not isinstance(new_status, str):
        raise HTTPException(status_code=400, detail="Status is required.")
    try:
        repository = RequestRepository(db)
        result = RequestService(repository).transition_status(request_id, new_status)
        repository.add_history_event(
            request_id,
            "status_change",
            f"Request status changed to {new_status}",
        )
        return result
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.get("/internal/requests/{request_id}/history", status_code=status.HTTP_200_OK)
def get_request_history(request_id: int, db: Session = Depends(get_db)):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService
    from app.services.history_service import HistoryService

    service = RequestService(RequestRepository(db))
    if not service.get_request_by_id(request_id):
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
    return HistoryService(service.repository).list(request_id)


@app.post("/internal/requests/{request_id}/notes", status_code=status.HTTP_201_CREATED)
def add_request_note(
    request_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService
    from app.services.history_service import HistoryService

    try:
        repository = RequestRepository(db)
        RequestService(repository)._get_request(request_id)
        note = HistoryService(repository).add_note(
            request_id, payload.get("body", ""), payload.get("author_id")
        )
        repository.add_history_event(request_id, "note", "Internal note added")
        return note
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err)) from err
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.get("/internal/requests/{request_id}/notes", status_code=status.HTTP_200_OK)
def get_request_notes(request_id: int, db: Session = Depends(get_db)):
    from app.repositories.request_repository import RequestRepository
    from app.services.request_service import RequestService
    from app.services.history_service import HistoryService

    repository = RequestRepository(db)
    if not RequestService(repository).get_request_by_id(request_id):
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")
    return HistoryService(repository).list_notes(request_id)


@app.get("/internal/dashboard", status_code=status.HTTP_200_OK)
def get_dashboard(db: Session = Depends(get_db)):
    from app.repositories.request_repository import RequestRepository

    return RequestRepository(db).dashboard()