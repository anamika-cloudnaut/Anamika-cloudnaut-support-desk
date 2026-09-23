import os

import httpx
from fastapi import APIRouter, HTTPException, status

from schemas.request import TicketCreate, TicketResponse

router = APIRouter(
    prefix="/requests",
    tags=["Requests"],
)

BACKEND_URL = os.getenv(
    "BACKEND_URL",
    "http://localhost:8001",
)

BACKEND_CREATE_TICKET_PATH = os.getenv(
    "BACKEND_CREATE_TICKET_PATH",
    "/internal/requests",
)

BACKEND_TIMEOUT = float(
    os.getenv("BACKEND_TIMEOUT", "10"),
)


@router.post(
    "",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket(ticket: TicketCreate):
    payload = ticket.model_dump(mode="json")

    try:
        async with httpx.AsyncClient(
            base_url=BACKEND_URL,
            timeout=BACKEND_TIMEOUT,
        ) as client:
            response = await client.post(
                BACKEND_CREATE_TICKET_PATH,
                json=payload,
            )

    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Backend service is unavailable",
        ) from exc

    if response.status_code >= 400:
        try:
            body = response.json()
            detail = body.get(
                "detail",
                "Ticket creation failed",
            )
        except ValueError:
            detail = "Ticket creation failed"

        raise HTTPException(
            status_code=response.status_code,
            detail=detail,
        )

    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Backend returned invalid response",
        ) from exc