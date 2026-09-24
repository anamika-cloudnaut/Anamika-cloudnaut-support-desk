from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.requests import router as requests_router


app = FastAPI(
    title="Cloudnaut Support Desk API",
    description="API for creating and managing support tickets",
    version="1.0.0",
)


# Allow frontend to call the API from Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "cloudnaut-support-desk-api",
    }


app.include_router(requests_router)