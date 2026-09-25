import os

import httpx
from fastapi import APIRouter, HTTPException, Query, status

from schemas.assignment import AssignmentRequest
from schemas.dashboard import DashboardSummary
from schemas.history import HistoryResponse
from schemas.note import NoteCreate, NoteResponse
from schemas.request import TicketCreate, TicketResponse, TicketUpdate
from schemas.team_members import TeamMemberResponse
from schemas.status import StatusUpdate

router = APIRouter(prefix="/requests", tags=["Requests"])
team_router = APIRouter(tags=["Team Members"])

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
BACKEND_TIMEOUT = float(os.getenv("BACKEND_TIMEOUT", "10"))

VALID_SORT_BY = {
    "created_at",
    "updated_at",
    "priority",
    "status",
    "title",
}

VALID_SORT_ORDER = {
    "asc",
    "desc",
}


async def backend_request(
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json: dict | None = None,
):
    """
    Send request to internal backend service and forward
    backend HTTP errors to the public API.
    """
    try:
        async with httpx.AsyncClient(
            base_url=BACKEND_URL,
            timeout=BACKEND_TIMEOUT,
        ) as client:
            if method == "GET":
                response = await client.get(path, params=params)
            elif method == "POST":
                response = await client.post(
                    path,
                    **({"params": params} if params is not None else {}),
                    json=json,
                )
            elif method == "PATCH":
                response = await client.patch(
                    path,
                    **({"params": params} if params is not None else {}),
                    json=json,
                )
            else:
                raise RuntimeError(f"Unsupported backend HTTP method: {method}")
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Backend service is unavailable",
        ) from exc

    try:
        data = response.json()
    except ValueError:
        data = None

    if response.status_code >= 400:
        if isinstance(data, dict) and "detail" in data:
            detail = data["detail"]
        else:
            detail = "Backend request failed"

        raise HTTPException(
            status_code=response.status_code,
            detail=detail,
        )

    return data


# ---------------------------------------------------------
# CREATE REQUEST
# ---------------------------------------------------------

@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket(ticket: TicketCreate):
    payload = ticket.model_dump(mode="json")

    data = await backend_request(
        "POST",
        "/internal/requests",
        json=payload,
    )

    return data


# ---------------------------------------------------------
# LIST REQUESTS
# ---------------------------------------------------------

@router.get(
    "",
    response_model=list[TicketResponse],
)
async def list_requests(
    status_filter: str | None = Query(default=None, alias="status"),
    assigned_to: int | None = None,
    category: str | None = None,
    priority: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
):
    if sort_by not in VALID_SORT_BY:
        raise HTTPException(
            status_code=400,
            detail="Invalid sort field.",
        )

    if sort_order not in VALID_SORT_ORDER:
        raise HTTPException(
            status_code=400,
            detail="Invalid sort order.",
        )

    params = {
        "status": status_filter,
        "assigned_to": assigned_to,
        "category": category,
        "priority": priority,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }

    params = {
        key: value
        for key, value in params.items()
        if value is not None
    }

    data = await backend_request(
        "GET",
        "/internal/requests",
        params=params,
    )

    return data


# ---------------------------------------------------------
# GET REQUEST
# ---------------------------------------------------------

@router.get(
    "/{request_id}",
    response_model=TicketResponse,
)
async def get_request(request_id: int):
    if request_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Request ID must be a positive integer.",
        )

    data = await backend_request(
        "GET",
        f"/internal/requests/{request_id}",
    )

    return data


# ---------------------------------------------------------
# UPDATE REQUEST FIELDS
# ---------------------------------------------------------

@router.patch(
    "/{request_id}",
    response_model=TicketResponse,
)
async def update_ticket(
    request_id: int,
    ticket: TicketUpdate,
):
    if request_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Request ID must be a positive integer.",
        )

    payload = ticket.model_dump(
        mode="json",
        exclude_unset=True,
    )

    if not payload:
        raise HTTPException(
            status_code=400,
            detail="At least one field must be provided.",
        )

    data = await backend_request(
        "PATCH",
        f"/internal/requests/{request_id}",
        json=payload,
    )

    return data


# ---------------------------------------------------------
# ASSIGN / UNASSIGN REQUEST
# ---------------------------------------------------------

@router.patch(
    "/{request_id}/assignment",
    response_model=TicketResponse,
)
async def update_assignment(
    request_id: int,
    assignment: AssignmentRequest,
):
    if request_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Request ID must be a positive integer.",
        )

    payload = assignment.model_dump(mode="json")

    data = await backend_request(
        "PATCH",
        f"/internal/requests/{request_id}/assignment",
        json=payload,
    )

    return data


# ---------------------------------------------------------
# CHANGE STATUS
# ---------------------------------------------------------

@router.patch(
    "/{request_id}/status",
    response_model=TicketResponse,
)
async def update_status(
    request_id: int,
    status_update: StatusUpdate,
):
    if request_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Request ID must be a positive integer.",
        )

    payload = status_update.model_dump(mode="json")

    data = await backend_request(
        "PATCH",
        f"/internal/requests/{request_id}/status",
        json=payload,
    )

    return data


# ---------------------------------------------------------
# ADD NOTE
# ---------------------------------------------------------

@router.post(
    "/{request_id}/notes",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_note(
    request_id: int,
    note: NoteCreate,
):
    if request_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Request ID must be a positive integer.",
        )

    payload = note.model_dump(mode="json")

    data = await backend_request(
        "POST",
        f"/internal/requests/{request_id}/notes",
        json=payload,
    )

    return data


# ---------------------------------------------------------
# GET HISTORY
# ---------------------------------------------------------

@router.get(
    "/{request_id}/history",
    response_model=list[HistoryResponse],
)
async def get_history(request_id: int):
    if request_id <= 0:
        raise HTTPException(
            status_code=400,
            detail="Request ID must be a positive integer.",
        )

    data = await backend_request(
        "GET",
        f"/internal/requests/{request_id}/history",
    )

    return data


# ---------------------------------------------------------
# GET TEAM MEMBERS
# ---------------------------------------------------------

@team_router.get(
    "/team-members",
    response_model=list[TeamMemberResponse],
)
async def get_team_members(
    active_only: bool = False,
):
    params = {
        "active_only": active_only,
    }

    data = await backend_request(
        "GET",
        "/internal/team-members",
        params=params,
    )

    return data


# ---------------------------------------------------------
# GET DASHBOARD
# ---------------------------------------------------------

dashboard_router = APIRouter(tags=["Dashboard"])


@dashboard_router.get(
    "/dashboard/summary",
    response_model=DashboardSummary,
)
async def get_dashboard_summary():
    data = await backend_request(
        "GET",
        "/internal/dashboard",
    )

    return data