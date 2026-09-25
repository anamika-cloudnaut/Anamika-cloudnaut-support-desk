from typing import Optional, Dict, Any, Union
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session
from database.app.models import HistoryEvent, SupportRequest, TeamMember, TicketNote


class RequestRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_request(self, request_data: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """
        Creates a SupportRequest in PostgreSQL and returns a fully populated dict
        including server-generated timestamps (created_at, updated_at).
        """
        # 1. Standardize incoming payload to dict
        if hasattr(request_data, "dict"):
            data = request_data.dict()
        elif hasattr(request_data, "model_dump"):
            data = request_data.model_dump()
        else:
            data = dict(request_data)

        # 2. Parse due_date string to datetime if provided as string
        if isinstance(data.get("due_date"), str):
            data["due_date"] = datetime.fromisoformat(data["due_date"])

        # 3. Filter keys matching SupportRequest table columns
        valid_keys = {column.name for column in SupportRequest.__table__.columns}
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}

        # 4. Save to Database
        db_request = SupportRequest(**filtered_data)
        self.db.add(db_request)
        self.db.commit()
        
        # 5. REFRESH: Forces SQLAlchemy to pull created_at & updated_at from PostgreSQL
        self.db.refresh(db_request)

        # 6. Return a clean dictionary representation with timestamps
        return {
            "id": db_request.id,
            "title": db_request.title,
            "description": db_request.description,
            "requester_name": db_request.requester_name,
            "requester_email": db_request.requester_email,
            "category": db_request.category,
            "priority": db_request.priority,
            "status": db_request.status,
            "assigned_to": db_request.assigned_to,
            "due_date": db_request.due_date.isoformat() if db_request.due_date else None,
            "created_at": db_request.created_at.isoformat() if db_request.created_at else None,
            "updated_at": db_request.updated_at.isoformat() if db_request.updated_at else None,
        }

    def get_request_by_id(self, request_id: int) -> Optional[SupportRequest]:
        return self.db.query(SupportRequest).filter(SupportRequest.id == request_id).first()

    def update_request(self, request: SupportRequest, fields: Dict[str, Any]):
        if isinstance(fields.get("due_date"), str):
            fields = dict(fields)
            fields["due_date"] = datetime.fromisoformat(fields["due_date"])
        for field, value in fields.items():
            setattr(request, field, value)
        self.db.commit()
        self.db.refresh(request)
        return request

    def list_team_members(self, active_only: bool = False):
        query = self.db.query(TeamMember)
        if active_only:
            query = query.filter(TeamMember.is_active.is_(True))
        return query.order_by(TeamMember.name.asc()).all()

    def list_requests(
        self,
        *,
        status: Optional[str] = None,
        assigned_to: Optional[int] = None,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ):
        sort_columns = {
            "created_at": SupportRequest.created_at,
            "updated_at": SupportRequest.updated_at,
            "priority": SupportRequest.priority,
            "status": SupportRequest.status,
            "title": SupportRequest.title,
        }
        query = self.db.query(SupportRequest)
        if status:
            query = query.filter(SupportRequest.status == status)
        if assigned_to is not None:
            query = query.filter(SupportRequest.assigned_to == assigned_to)
        if category:
            query = query.filter(SupportRequest.category == category)
        if priority:
            query = query.filter(SupportRequest.priority == priority)

        column = sort_columns[sort_by]
        query = query.order_by(column.asc() if sort_order == "asc" else column.desc())
        return query.all()

    def assign_request(self, request: SupportRequest, assignee: Optional[TeamMember]):
        request.assignee = assignee
        self.db.commit()
        self.db.refresh(request)
        return request

    def update_status(self, request: SupportRequest, new_status: str):
        request.status = new_status
        self.db.commit()
        self.db.refresh(request)
        return request

    def add_history_event(self, request_id: int, event_type: str, description: str):
        event = HistoryEvent(
            request_id=request_id,
            event_type=event_type,
            description=description,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        return event

    def list_history(self, request_id: int):
        return (
            self.db.query(HistoryEvent)
            .filter(HistoryEvent.request_id == request_id)
            .order_by(HistoryEvent.created_at.asc(), HistoryEvent.id.asc())
            .all()
        )

    def add_note(self, request_id: int, body: str, author_id: Optional[int] = None):
        note = TicketNote(request_id=request_id, body=body, author_id=author_id)
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def list_notes(self, request_id: int):
        return (
            self.db.query(TicketNote)
            .filter(TicketNote.request_id == request_id)
            .order_by(TicketNote.created_at.asc(), TicketNote.id.asc())
            .all()
        )

    def get_team_member(self, member_id: int) -> Optional[TeamMember]:
        return self.db.query(TeamMember).filter(TeamMember.id == member_id).first()

    def dashboard(self):
        counts = dict(
            self.db.query(SupportRequest.status, func.count(SupportRequest.id))
            .group_by(SupportRequest.status)
            .all()
        )
        assignee_counts = dict(
            self.db.query(SupportRequest.assigned_to, func.count(SupportRequest.id))
            .filter(SupportRequest.assigned_to.isnot(None))
            .group_by(SupportRequest.assigned_to)
            .all()
        )
        return {
            "total": self.db.query(SupportRequest).count(),
            "by_status": counts,
            "assigned": sum(assignee_counts.values()),
            "unassigned": self.db.query(SupportRequest)
            .filter(SupportRequest.assigned_to.is_(None))
            .count(),
            "by_assignee": assignee_counts,
        }