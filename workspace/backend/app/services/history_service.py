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

    def add_note(self, request_id: int, body: str, author_id: Optional[int] = None):
        if not body or not body.strip():
            raise ValueError("Note body cannot be empty.")
        return self.repository.add_note(request_id, body.strip(), author_id)

    def list_notes(self, request_id: int):
        return self.repository.list_notes(request_id)