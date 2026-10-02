from typing import Optional, Dict, Any, Union
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session
from database.app.models import HistoryEvent, SupportRequest, TeamMember, TicketNote


class RequestRepository:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _request_to_dict(request: SupportRequest) -> Dict[str, Any]:
        return {
            "id": request.id,
            "title": request.title,
            "description": request.description,
            "requester_name": request.requester_name,
            "requester_email": request.requester_email,
            "category": request.category,
            "priority": request.priority,
            "status": request.status,
            "assigned_to": request.assigned_to,
            "assigned_to_name": request.assignee.name if request.assignee else None,
            "due_date": request.due_date.isoformat() if request.due_date else None,
            "created_at": request.created_at.isoformat() if request.created_at else None,
            "updated_at": request.updated_at.isoformat() if request.updated_at else None,
        }

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
            "assigned_to_name": db_request.assignee.name if db_request.assignee else None,
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
        return self._request_to_dict(request)

    def list_team_members(self, active_only: bool = False):
        query = self.db.query(TeamMember)
        if active_only:
            query = query.filter(TeamMember.is_active.is_(True))
        return query.order_by(TeamMember.name.asc()).all()

    def get_team_member_by_email(self, email: str) -> Optional[TeamMember]:
        return self.db.query(TeamMember).filter(func.lower(TeamMember.email) == email.lower()).first()

    def create_team_member(self, member_data: Dict[str, Any]) -> TeamMember:
        member = TeamMember(**member_data)
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def update_team_member(self, member: TeamMember, fields: Dict[str, Any]) -> TeamMember:
        for field, value in fields.items():
            setattr(member, field, value)
        self.db.commit()
        self.db.refresh(member)
        return member

    def count_active_admins(self) -> int:
        return self.db.query(TeamMember).filter(
            TeamMember.role == "admin", TeamMember.is_active.is_(True)
        ).count()

    def list_requests(
        self,
        *,
        status: Optional[str] = None,
        assigned_to: Optional[int] = None,
        assignment: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[str] = None,
        requester_email: Optional[str] = None,
        created_from: Optional[str] = None,
        created_to: Optional[str] = None,
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
        if assignment == "assigned":
            query = query.filter(SupportRequest.assigned_to.isnot(None))
        elif assignment == "unassigned":
            query = query.filter(SupportRequest.assigned_to.is_(None))
        if category:
            query = query.filter(SupportRequest.category == category)
        if priority:
            query = query.filter(SupportRequest.priority == priority)
        if requester_email:
            query = query.filter(func.lower(SupportRequest.requester_email) == requester_email.lower())
        # Inclusive calendar-day range on the created_at date. Matches the
        # dashboard's 7-day trend buckets (func.date == YYYY-MM-DD).
        created_date = func.date(SupportRequest.created_at)
        if created_from:
            query = query.filter(created_date >= created_from)
        if created_to:
            query = query.filter(created_date <= created_to)

        column = sort_columns[sort_by]
        query = query.order_by(column.asc() if sort_order == "asc" else column.desc())
        return query.all()

    def assign_request(self, request: SupportRequest, assignee: Optional[TeamMember]):
        request.assignee = assignee
        self.db.commit()
        self.db.refresh(request)
        return self._request_to_dict(request)

    def update_status(self, request: SupportRequest, new_status: str):
        request.status = new_status
        self.db.commit()
        self.db.refresh(request)
        return self._request_to_dict(request)

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

    def add_note(
        self,
        request_id: int,
        note_text: str,
        created_by: Optional[str] = None,
        is_public: bool = False,
    ):
        note = TicketNote(
            request_id=request_id,
            note=note_text,
            created_by=created_by,
            is_public=is_public,
        )
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return {
            "id": note.id,
            "request_id": note.request_id,
            "note": note.note,
            "created_by": note.created_by,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "is_public": note.is_public,
        }

    def list_notes(self, request_id: int):
        return (
            self.db.query(TicketNote)
            .filter(TicketNote.request_id == request_id)
            .order_by(TicketNote.created_at.asc(), TicketNote.id.asc())
            .all()
        )

    def list_public_updates(self, requester_email: str):
        rows = (
            self.db.query(TicketNote, SupportRequest.title)
            .join(SupportRequest, SupportRequest.id == TicketNote.request_id)
            .filter(
                TicketNote.is_public.is_(True),
                func.lower(SupportRequest.requester_email) == requester_email.lower(),
            )
            .order_by(TicketNote.created_at.desc(), TicketNote.id.desc())
            .all()
        )
        return [
            {
                "id": note.id,
                "request_id": note.request_id,
                "ticket_title": title,
                "note": note.note,
                "created_by": note.created_by,
                "created_at": note.created_at,
                "is_public": note.is_public,
            }
            for note, title in rows
        ]

    def get_team_member(self, member_id: int) -> Optional[TeamMember]:
        return self.db.query(TeamMember).filter(TeamMember.id == member_id).first()

    def dashboard(self):
        counts = dict(
            self.db.query(SupportRequest.status, func.count(SupportRequest.id))
            .group_by(SupportRequest.status)
            .all()
        )
        priority_counts = dict(
            self.db.query(SupportRequest.priority, func.count(SupportRequest.id))
            .group_by(SupportRequest.priority)
            .all()
        )
        category_counts = dict(
            self.db.query(SupportRequest.category, func.count(SupportRequest.id))
            .group_by(SupportRequest.category)
            .all()
        )
        assignee_counts = dict(
            self.db.query(TeamMember.name, func.count(SupportRequest.id))
            .join(TeamMember, SupportRequest.assigned_to == TeamMember.id)
            .filter(SupportRequest.assigned_to.isnot(None))
            .group_by(TeamMember.name)
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
            "by_priority": priority_counts,
            "by_category": category_counts,
            "recent": self._recent_ticket_trend(),
        }

    def _recent_ticket_trend(self, days: int = 7):
        """Tickets created per calendar day for the last `days` days (oldest first).

        Returns a dense series (zero-filled) so the frontend can draw a trend
        without having to reconstruct missing dates.
        """
        from datetime import datetime, timedelta, timezone

        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=days - 1)

        created_date = func.date(SupportRequest.created_at)
        rows = (
            self.db.query(created_date, func.count(SupportRequest.id))
            .filter(SupportRequest.created_at.isnot(None))
            .filter(created_date >= start.isoformat())
            .group_by(created_date)
            .all()
        )
        counts_by_day = {str(day): int(count) for day, count in rows}

        series = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            key = day.isoformat()
            series.append({"date": key, "count": counts_by_day.get(key, 0)})
        return series