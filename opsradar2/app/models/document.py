"""Document model aligned with the v4 OpsRadar schema."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    uploaded_by_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), default="other")
    mime_type = Column(String(100), nullable=True)
    storage_uri = Column(String(500), nullable=True)
    content_hash = Column(String(128), nullable=True)
    analysis_status = Column(String(50), default="uploaded")
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
