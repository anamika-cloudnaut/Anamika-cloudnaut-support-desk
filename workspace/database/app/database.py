import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.app.models import Base

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://cloudnaut:cloudnaut_pass@localhost:5432/cloudnaut_db"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all tables if they do not exist."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for yielding database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()