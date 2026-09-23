from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=schemas.SupportRequestOut, status_code=201)
def create_request(payload: schemas.SupportRequestCreate, db: Session = Depends(get_db)):
    if payload.assigned_to is not None:
        member = db.query(models.TeamMember).filter(
            models.TeamMember.id == payload.assigned_to
        ).first()
        if not member or not member.is_active:
            raise HTTPException(
                status_code=400,
                detail="assigned_to must reference an existing, active team member",
            )

    new_request = models.SupportRequest(**payload.model_dump())
    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    history_entry = models.HistoryEvent(
        request_id=new_request.id,
        event_type="created",
        description=f"Request created by {new_request.requester_name}",
    )
    db.add(history_entry)
    db.commit()

    return new_request


@router.get("/{request_id}", response_model=schemas.SupportRequestOut)
def get_request(request_id: int, db: Session = Depends(get_db)):
    request_obj = db.query(models.SupportRequest).filter(
        models.SupportRequest.id == request_id
    ).first()
    if not request_obj:
        raise HTTPException(status_code=404, detail="Support request not found")
    return request_obj