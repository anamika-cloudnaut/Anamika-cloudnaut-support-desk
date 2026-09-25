from typing import Optional, Dict, Any, Union


class RequestService:
    def __init__(self, repository=None):
        """
        Service layer handling business logic for support requests.
        Optionally accepts a RequestRepository instance.
        """
        self.repository = repository

    def create_request(self, request_data: Union[Dict[str, Any], Any]) -> Dict[str, Any]:
        """
        Validates business constraints and creates a new support request.
        """
        if not self.repository:
            raise RuntimeError("RequestRepository is required to execute create_request.")

        # Convert Pydantic payloads to dict for inspection if needed
        if hasattr(request_data, "model_dump"):
            data = request_data.model_dump()
        elif hasattr(request_data, "dict"):
            data = request_data.dict()
        else:
            data = dict(request_data)

        # Business Rule Validations
        title = data.get("title")
        if not title or not str(title).strip():
            raise ValueError("Title cannot be empty.")

        requester_email = data.get("requester_email")
        if not requester_email or "@" not in str(requester_email):
            raise ValueError("A valid requester_email is required.")

        return self.repository.create_request(data)

    def get_request_by_id(self, request_id: int) -> Optional[Dict[str, Any]]:
        """
        Retrieves a support request by its unique ID.
        """
        if not self.repository:
            raise RuntimeError("RequestRepository is required to execute get_request_by_id.")

        if request_id <= 0:
            raise ValueError("Request ID must be a positive integer.")

        return self.repository.get_request_by_id(request_id)

    def update_request(self, request_id: int, fields: Dict[str, Any]):
        if not fields:
            raise ValueError("At least one editable field is required.")
        request = self._get_request(request_id)
        editable_fields = {
            "title",
            "description",
            "requester_name",
            "requester_email",
            "category",
            "priority",
            "due_date",
        }
        unsupported = set(fields) - editable_fields
        if unsupported:
            raise ValueError(
                f"Unsupported request fields: {', '.join(sorted(unsupported))}."
            )
        if "title" in fields and not str(fields["title"]).strip():
            raise ValueError("Title cannot be empty.")
        if "description" in fields and not str(fields["description"]).strip():
            raise ValueError("Description cannot be empty.")
        if "requester_email" in fields and (
            not fields["requester_email"] or "@" not in str(fields["requester_email"])
        ):
            raise ValueError("A valid requester_email is required.")
        return self.repository.update_request(request, fields)

    def list_team_members(self, active_only: bool = False):
        return self.repository.list_team_members(active_only)

    def _get_request(self, request_id: int):
        if request_id <= 0:
            raise ValueError("Request ID must be a positive integer.")
        request = self.repository.get_request_by_id(request_id)
        if not request:
            raise LookupError(f"Request {request_id} not found.")
        return request