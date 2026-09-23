from typing import Dict, Any, List, Optional

class RequestRepository:
    """Repository layer responsible for operations on support requests."""
    
    def __init__(self):
        self._db: Dict[int, Dict[str, Any]] = {}

    def create_request(self, request_data: dict) -> dict:
        req_id = len(self._db) + 1
        request_data["id"] = req_id
        self._db[req_id] = request_data
        return request_data

    def get_by_id(self, request_id: int) -> Optional[dict]:
        return self._db.get(request_id)

    def get_all(self, filters: Optional[dict] = None) -> List[dict]:
        return list(self._db.values())

    def update_request(self, request_id: int, updates: dict) -> Optional[dict]:
        if request_id not in self._db:
            return None
        self._db[request_id].update(updates)
        return self._db[request_id]