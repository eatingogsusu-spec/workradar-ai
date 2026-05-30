from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class Document(TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(
            "source_type IN ('email', 'meeting', 'chat', 'other')",
            name="documents_source_type_check",
        ),
        CheckConstraint("status IN ('parsing', 'embedding', 'completed', 'failed')", name="documents_status_check"),
        Index("idx_documents_project_id", "project_id"),
        Index("idx_documents_uploaded_by", "uploaded_by"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="other")
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="parsing")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="documents")
    uploader: Mapped[User] = relationship("User", back_populates="uploaded_documents", foreign_keys=[uploaded_by])
    chunks: Mapped[list[DocumentChunk]] = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    todos: Mapped[list[Todo]] = relationship("Todo", back_populates="source_document")
    issues: Mapped[list[Issue]] = relationship("Issue", back_populates="source_document")
    ai_summaries: Mapped[list[AISummary]] = relationship("AISummary", back_populates="document")
