"""Calendar event model aligned with the current OpsRadar2 schema."""

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    source_chunk_id = Column(UUID(as_uuid=True), ForeignKey("document_chunks.id"), nullable=True)
    event_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False, default="manual")
    approval_status = Column(String(20), nullable=False, default="approved")
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
