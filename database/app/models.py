from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)

    # Relationships
    assigned_requests = relationship("SupportRequest", back_populates="assignee")


class SupportRequest(Base):
    __tablename__ = "support_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    requester_name = Column(String(100), nullable=False)
    requester_email = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    priority = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="Open")
    assigned_to = Column(Integer, ForeignKey("team_members.id"), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    assignee = relationship("TeamMember", back_populates="assigned_requests")
    history_events = relationship(
        "HistoryEvent", back_populates="request", cascade="all, delete-orphan"
    )


class HistoryEvent(Base):
    __tablename__ = "history_events"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(
        Integer, ForeignKey("support_requests.id", ondelete="CASCADE"), nullable=False
    )
    event_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    request = relationship("SupportRequest", back_populates="history_events")