import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.app.models import Base


@pytest.fixture(scope="function")
def db_session():
    """Creates a fresh in-memory database for each test session."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()