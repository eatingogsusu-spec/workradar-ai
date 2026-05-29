"""Todo model aligned with the v4 OpsRadar schema."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class Todo(Base):
    __tablename__ = "todos"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    assignee_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    created_by_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    reviewed_by_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    source_document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    source_chunk_id = Column(UUID(as_uuid=True), ForeignKey("document_chunks.id"), nullable=True)
    linked_issue_id = Column(UUID(as_uuid=True), ForeignKey("issues.id"), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="pending")
    priority = Column(String(20), default="medium")
    source_type = Column(String(20), default="manual")
    approval_status = Column(String(20), default="approved")
    confidence_score = Column(Integer, nullable=True)
    due_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
