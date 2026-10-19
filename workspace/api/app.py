from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.requests import (
    router as requests_router,
    team_router,
    dashboard_router,
)
from routers.attachments import router as attachments_router


app = FastAPI(
    title="Cloudnaut Support Desk API",
    description="API for creating and managing support tickets",
    version="1.0.0",
)


# Allow frontend to call the API from Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------

@app.middleware("http")
async def no_store_cache_headers(request, call_next):
    """Never allow API responses to be cached.

    These responses are per-user and authenticated; CloudFront (or any
    intermediary) must not store or reuse them across requests/users.
    """
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    return response


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "cloudnaut-support-desk-api",
    }


# ---------------------------------------------------------
# API ROUTERS
# ---------------------------------------------------------

app.include_router(requests_router)
app.include_router(attachments_router)
app.include_router(team_router)
app.include_router(dashboard_router)