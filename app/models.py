from __future__ import annotations

import uuid
from datetime import datetime, date

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))


def now_col() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("idx_users_team_id", "team_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, server_default="member")
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (Index("idx_projects_team_id", "team_id"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="active")
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
        Index("idx_project_members_team_id", "team_id"),
        Index("idx_project_members_project_id", "project_id"),
        Index("idx_project_members_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, server_default="member")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="active")
    joined_at: Mapped[datetime] = now_col()


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("idx_documents_project_id", "project_id"),
        Index("idx_documents_uploaded_by_member_id", "uploaded_by_member_id"),
        Index("idx_documents_status", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    uploaded_by_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)
    storage_uri: Mapped[str] = mapped_column(String(1000), nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="uploaded")
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_document_index"),
        Index("idx_document_chunks_document_id", "document_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer)
    content_hash: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = now_col()


class FaissIndex(Base):
    __tablename__ = "faiss_indexes"
    __table_args__ = (
        UniqueConstraint("project_id", "version", name="uq_faiss_indexes_project_version"),
        Index("idx_faiss_indexes_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    index_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False)
    embedding_dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="building")
    created_at: Mapped[datetime] = now_col()
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChunkEmbedding(Base):
    __tablename__ = "chunk_embeddings"
    __table_args__ = (
        UniqueConstraint("faiss_index_id", "vector_external_id", name="uq_chunk_embeddings_faiss_vector"),
        Index("idx_chunk_embeddings_chunk_id", "chunk_id"),
        Index("idx_chunk_embeddings_faiss_index_id", "faiss_index_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    chunk_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False)
    faiss_index_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("faiss_indexes.id", ondelete="CASCADE"), nullable=False)
    vector_external_id: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(100), nullable=False)
    embedding_dimension: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = now_col()


class EmbeddingJob(Base):
    __tablename__ = "embedding_jobs"
    __table_args__ = (
        Index("idx_embedding_jobs_project_id", "project_id"),
        Index("idx_embedding_jobs_document_id", "document_id"),
        Index("idx_embedding_jobs_faiss_index_id", "faiss_index_id"),
        Index("idx_embedding_jobs_status", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    faiss_index_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("faiss_indexes.id", ondelete="SET NULL"))
    job_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="document_embedding")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="queued")
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Todo(Base):
    __tablename__ = "todos"
    __table_args__ = (
        Index("idx_todos_project_status", "project_id", "status"),
        Index("idx_todos_project_approval", "project_id", "approval_status"),
        Index("idx_todos_assignee_member_id", "assignee_member_id"),
        Index("idx_todos_due_at", "due_at"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="pending")
    priority: Mapped[str] = mapped_column(String(50), nullable=False, server_default="medium")
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="manual")
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="approved")
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (
        Index("idx_issues_project_status", "project_id", "status"),
        Index("idx_issues_project_severity", "project_id", "severity"),
        Index("idx_issues_project_approval", "project_id", "approval_status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False, server_default="medium")
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="open")
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="manual")
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="confirmed")
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"), onupdate=text("now()"))


class IssueHistory(Base):
    __tablename__ = "issue_history"
    __table_args__ = (
        Index("idx_issue_history_issue_id", "issue_id"),
        Index("idx_issue_history_changed_by_member_id", "changed_by_member_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    issue_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    changed_by_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = now_col()


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = (
        Index("idx_calendar_events_project_starts", "project_id", "starts_at"),
        Index("idx_calendar_events_member_id", "member_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="other")
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="manual")
    approval_status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="approved")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = now_col()


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    __table_args__ = (
        UniqueConstraint("project_id", "week_start", "week_end", name="uq_weekly_reports_project_week"),
        Index("idx_weekly_reports_project_week", "project_id", "week_start"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_by_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    progress_rate: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = now_col()


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"
    __table_args__ = (
        UniqueConstraint("project_id", "month_start", "month_end", name="uq_monthly_reports_project_month"),
        Index("idx_monthly_reports_project_month", "project_id", "month_start"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_by_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    month_start: Mapped[date] = mapped_column(Date, nullable=False)
    month_end: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    progress_rate: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = now_col()


class HandoffReport(Base):
    __tablename__ = "handoff_reports"
    __table_args__ = (Index("idx_handoff_reports_project_created", "project_id", "created_at"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    from_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    to_member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    handoff_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="project")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = now_col()


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("idx_chat_messages_project_created", "project_id", "created_at"),
        Index("idx_chat_messages_member_id", "member_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("project_members.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = now_col()


class AISummary(Base):
    __tablename__ = "ai_summaries"
    __table_args__ = (
        Index("idx_ai_summaries_project_id", "project_id"),
        Index("idx_ai_summaries_document_id", "document_id"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_faiss_index_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("faiss_indexes.id", ondelete="SET NULL"))
    todo_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    issue_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    blocked_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = now_col()
