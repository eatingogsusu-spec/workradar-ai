from __future__ import annotations

import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class Issue(TimestampMixin, Base):
    __tablename__ = "issues"
    __table_args__ = (
        CheckConstraint("severity IN ('low', 'medium', 'high')", name="issues_severity_check"),
        CheckConstraint("status IN ('open', 'in_progress', 'resolved')", name="issues_status_check"),
        CheckConstraint("source_type IN ('ai', 'manual')", name="issues_source_type_check"),
        CheckConstraint("confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100", name="issues_confidence_score_check"),
        Index("idx_issues_project_id", "project_id"),
        Index("idx_issues_status", "status"),
        Index("idx_issues_severity", "severity"),
        Index("idx_issues_project_status", "project_id", "status"),
        Index("idx_issues_project_severity", "project_id", "severity"),
        Index("idx_issues_project_candidate", "project_id", "is_candidate"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reporter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, server_default="medium")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="open")
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="manual")
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    is_candidate: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    project: Mapped[Project] = relationship("Project", back_populates="issues")
    reporter: Mapped[User] = relationship("User", back_populates="reported_issues", foreign_keys=[reporter_id])
    assignee: Mapped[User | None] = relationship("User", back_populates="assigned_issues", foreign_keys=[assignee_id])
    source_document: Mapped[Document | None] = relationship("Document", back_populates="issues")
