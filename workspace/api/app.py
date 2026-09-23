from fastapi import FastAPI

from routers.requests import router as requests_router


app = FastAPI(
    title="Cloudnaut Support Desk API",
    description="API layer for Cloudnaut Support Desk",
    version="1.0.0",
)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "cloudnaut-support-desk-api",
    }


app.include_router(requests_router)
from fastapi import FastAPI

from routers.requests import router as requests_router


app = FastAPI(
    title="Cloudnaut Support Desk API",
    description="API for creating and managing support tickets",
    version="1.0.0",
)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "cloudnaut-support-desk-api",
    }


app.include_router(requests_router)