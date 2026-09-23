from typing import Optional, List, Dict, Any
from app.services.status_service import validate_status_transition
from app.repositories.request_repository import RequestRepository

class RequestService:
    def __init__(self, repository: Optional[RequestRepository] = None):
        self.repository = repository or RequestRepository()

    def create_request(
        self, 
        title: str, 
        description: str, 
        requester_name: str,
        requester_email: str,
        category: str, 
        priority: str,
        due_date: Optional[str] = None
    ) -> Dict[str, Any]:
        if not title or not title.strip():
            raise ValueError("Title cannot be empty.")
        if not requester_email or "@" not in requester_email:
            raise ValueError("Invalid requester email address.")
        
        data = {
            "title": title,
            "description": description,
            "requester_name": requester_name,
            "requester_email": requester_email,
            "category": category,
            "priority": priority,
            "due_date": due_date,
            "status": "Open",
            "assigned_to": None,
        }
        return self.repository.create_request(data)

    def update_status(self, request_id: int, new_status: str) -> Dict[str, Any]:
        req = self.repository.get_by_id(request_id)
        if not req:
            raise KeyError(f"Request with ID '{request_id}' not found.")
        validate_status_transition(req["status"], new_status)
        return self.repository.update_request(request_id, {"status": new_status})

    def assign_team_member(self, request_id: int, member_id: str) -> Dict[str, Any]:
        req = self.repository.get_by_id(request_id)
        if not req:
            raise KeyError(f"Request with ID '{request_id}' not found.")
        if not member_id or not member_id.strip():
            raise ValueError("Team member ID cannot be empty.")
        return self.repository.update_request(request_id, {"assigned_to": member_id})