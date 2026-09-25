from typing import Optional


class HistoryService:
    def __init__(self, repository):
        self.repository = repository

    def record(self, request_id: int, event_type: str, description: str):
        if not event_type.strip():
            raise ValueError("Event type cannot be empty.")
        if not description.strip():
            raise ValueError("Event description cannot be empty.")
        return self.repository.add_history_event(request_id, event_type, description)

    def list(self, request_id: int):
        return self.repository.list_history(request_id)

    def add_note(self, request_id: int, note: str, created_by: Optional[str] = None):
        if not note or not note.strip():
            raise ValueError("Note cannot be empty.")
        return self.repository.add_note(request_id, note.strip(), created_by)

    def list_notes(self, request_id: int):
        return self.repository.list_notes(request_id)