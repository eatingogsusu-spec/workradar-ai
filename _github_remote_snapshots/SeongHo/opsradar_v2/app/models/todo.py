from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class Todo(TimestampMixin, Base):
    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="todos_status_check"),
        CheckConstraint("priority IN ('low', 'medium', 'high')", name="todos_priority_check"),
        CheckConstraint("source_type IN ('manual', 'ai')", name="todos_source_type_check"),
        CheckConstraint("approval_status IN ('pending', 'approved', 'rejected')", name="todos_approval_status_check"),
        CheckConstraint("confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100", name="todos_confidence_score_check"),
        Index("idx_todos_project_id", "project_id"),
        Index("idx_todos_assignee_id", "assignee_id"),
        Index("idx_todos_status", "status"),
        Index("idx_todos_source_type", "source_type"),
        Index("idx_todos_approval_status", "approval_status"),
        Index("idx_todos_due_date", "due_date"),
        Index("idx_todos_project_due_date", "project_id", "due_date"),
        Index("idx_todos_project_approval", "project_id", "approval_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="SET NULL"))
    linked_issue_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("issues.id", ondelete="SET NULL"))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="pending")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, server_default="medium")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="manual")
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="approved")
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime())
    due_date: Mapped[datetime | None] = mapped_column(DateTime())

    project: Mapped[Project] = relationship("Project", back_populates="todos")
    assignee: Mapped[User | None] = relationship("User", back_populates="assigned_todos", foreign_keys=[assignee_id])
    creator: Mapped[User] = relationship("User", back_populates="created_todos", foreign_keys=[created_by])
    reviewer: Mapped[User | None] = relationship("User", back_populates="reviewed_todos", foreign_keys=[reviewed_by])
    source_document: Mapped[Document | None] = relationship("Document", back_populates="todos")
    source_chunk: Mapped[DocumentChunk | None] = relationship("DocumentChunk", back_populates="source_todos")
