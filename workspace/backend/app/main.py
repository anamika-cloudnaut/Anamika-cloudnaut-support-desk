from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import engine, get_db, Base
from .routes import requests as requests_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cloudnaut Support Desk API")

app.include_router(requests_router.router)


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}