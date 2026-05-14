from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'member')", name="users_role_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False, server_default="member")

    created_projects: Mapped[list[Project]] = relationship(back_populates="creator", foreign_keys="Project.created_by")
    project_memberships: Mapped[list[ProjectMember]] = relationship(back_populates="user", cascade="all, delete-orphan")
    uploaded_documents: Mapped[list[Document]] = relationship(back_populates="uploader", foreign_keys="Document.uploaded_by")
    assigned_todos: Mapped[list[Todo]] = relationship(back_populates="assignee", foreign_keys="Todo.assignee_id")
    created_todos: Mapped[list[Todo]] = relationship(back_populates="creator", foreign_keys="Todo.created_by")
    reviewed_todos: Mapped[list[Todo]] = relationship(back_populates="reviewer", foreign_keys="Todo.reviewed_by")
    reported_issues: Mapped[list[Issue]] = relationship(back_populates="reporter", foreign_keys="Issue.reporter_id")
    assigned_issues: Mapped[list[Issue]] = relationship(back_populates="assignee", foreign_keys="Issue.assignee_id")
    chat_messages: Mapped[list[ChatMessage]] = relationship(back_populates="user")
    weekly_reports: Mapped[list[WeeklyReport]] = relationship(back_populates="creator", foreign_keys="WeeklyReport.created_by")
    handoff_reports: Mapped[list[HandoffReport]] = relationship(back_populates="creator", foreign_keys="HandoffReport.created_by")


class Team(TimestampMixin, Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    projects: Mapped[list[Project]] = relationship(back_populates="team", cascade="all, delete-orphan")


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'archived', 'completed')", name="projects_status_check"),
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="projects_date_check"),
        Index("idx_projects_team_id", "team_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="active")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)

    team: Mapped[Team] = relationship(back_populates="projects")
    creator: Mapped[User] = relationship(back_populates="created_projects", foreign_keys=[created_by])
    members: Mapped[list[ProjectMember]] = relationship(back_populates="project", cascade="all, delete-orphan")
    documents: Mapped[list[Document]] = relationship(back_populates="project", cascade="all, delete-orphan")
    document_chunks: Mapped[list[DocumentChunk]] = relationship(back_populates="project", cascade="all, delete-orphan")
    todos: Mapped[list[Todo]] = relationship(back_populates="project", cascade="all, delete-orphan")
    issues: Mapped[list[Issue]] = relationship(back_populates="project", cascade="all, delete-orphan")
    chat_messages: Mapped[list[ChatMessage]] = relationship(back_populates="project", cascade="all, delete-orphan")
    weekly_reports: Mapped[list[WeeklyReport]] = relationship(back_populates="project", cascade="all, delete-orphan")
    handoff_reports: Mapped[list[HandoffReport]] = relationship(back_populates="project", cascade="all, delete-orphan")
    ai_summaries: Mapped[list[AISummary]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        CheckConstraint("role IN ('owner', 'manager', 'member', 'viewer')", name="project_members_role_check"),
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
        Index("idx_project_members_project_id", "project_id"),
        Index("idx_project_members_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False, server_default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="project_memberships")


class Document(TimestampMixin, Base):
    __tablename__ = "documents"
    __table_args__ = (
        CheckConstraint(
            "source_type IN ('upload', 'slack', 'notion', 'google_meet', 'gmail', 'teams', 'jira', 'email', 'meeting', 'memo')",
            name="documents_source_type_check",
        ),
        CheckConstraint("status IN ('uploaded', 'processing', 'completed', 'failed')", name="documents_status_check"),
        Index("idx_documents_project_id", "project_id"),
        Index("idx_documents_uploaded_by", "uploaded_by"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(30), nullable=False)
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, server_default="upload")
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="uploaded")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="documents")
    uploader: Mapped[User] = relationship(back_populates="uploaded_documents", foreign_keys=[uploaded_by])
    chunks: Mapped[list[DocumentChunk]] = relationship(back_populates="document", cascade="all, delete-orphan")
    todos: Mapped[list[Todo]] = relationship(back_populates="source_document")
    issues: Mapped[list[Issue]] = relationship(back_populates="source_document")
    ai_summaries: Mapped[list[AISummary]] = relationship(back_populates="document")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (
        CheckConstraint("chunk_index >= 0", name="document_chunks_index_check"),
        CheckConstraint("page_number IS NULL OR page_number > 0", name="document_chunks_page_check"),
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_document_index"),
        Index("idx_document_chunks_document_id", "document_id"),
        Index("idx_document_chunks_project_id", "project_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    page_number: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    document: Mapped[Document] = relationship(back_populates="chunks")
    project: Mapped[Project] = relationship(back_populates="document_chunks")
    embedding_refs: Mapped[list[ChunkEmbedding]] = relationship(back_populates="chunk", cascade="all, delete-orphan")
    source_todos: Mapped[list[Todo]] = relationship(back_populates="source_chunk")


class ChunkEmbedding(Base):
    __tablename__ = "chunk_embeddings"
    __table_args__ = (
        UniqueConstraint("vector_store", "vector_id", name="uq_chunk_embeddings_vector"),
        Index("idx_chunk_embeddings_chunk_id", "chunk_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    chunk_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False)
    vector_store: Mapped[str] = mapped_column(String(80), nullable=False, server_default="faiss")
    vector_id: Mapped[str] = mapped_column(String(255), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    chunk: Mapped[DocumentChunk] = relationship(back_populates="embedding_refs")


class Todo(TimestampMixin, Base):
    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint("status IN ('todo', 'in_progress', 'done', 'delayed', 'cancelled')", name="todos_status_check"),
        CheckConstraint("priority IN ('low', 'medium', 'high', 'urgent')", name="todos_priority_check"),
        CheckConstraint("source_type IN ('manual', 'ai')", name="todos_source_type_check"),
        CheckConstraint("approval_status IN ('pending', 'approved', 'rejected')", name="todos_approval_status_check"),
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
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="todo")
    priority: Mapped[str] = mapped_column(String(30), nullable=False, server_default="medium")
    source_type: Mapped[str] = mapped_column(String(30), nullable=False, server_default="manual")
    approval_status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="approved")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[date | None] = mapped_column(Date)

    project: Mapped[Project] = relationship(back_populates="todos")
    assignee: Mapped[User | None] = relationship(back_populates="assigned_todos", foreign_keys=[assignee_id])
    creator: Mapped[User] = relationship(back_populates="created_todos", foreign_keys=[created_by])
    reviewer: Mapped[User | None] = relationship(back_populates="reviewed_todos", foreign_keys=[reviewed_by])
    source_document: Mapped[Document | None] = relationship(back_populates="todos")
    source_chunk: Mapped[DocumentChunk | None] = relationship(back_populates="source_todos")


class Issue(TimestampMixin, Base):
    __tablename__ = "issues"
    __table_args__ = (
        CheckConstraint("severity IN ('low', 'medium', 'high', 'critical')", name="issues_severity_check"),
        CheckConstraint("status IN ('open', 'in_progress', 'resolved', 'closed')", name="issues_status_check"),
        Index("idx_issues_project_id", "project_id"),
        Index("idx_issues_status", "status"),
        Index("idx_issues_severity", "severity"),
        Index("idx_issues_project_status", "project_id", "status"),
        Index("idx_issues_project_severity", "project_id", "severity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reporter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    source_document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(30), nullable=False, server_default="medium")
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="open")

    project: Mapped[Project] = relationship(back_populates="issues")
    reporter: Mapped[User] = relationship(back_populates="reported_issues", foreign_keys=[reporter_id])
    assignee: Mapped[User | None] = relationship(back_populates="assigned_issues", foreign_keys=[assignee_id])
    source_document: Mapped[Document | None] = relationship(back_populates="issues")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant', 'system')", name="chat_messages_role_check"),
        CheckConstraint("jsonb_typeof(sources_json) = 'array'", name="chat_messages_sources_array_check"),
        Index("idx_chat_messages_project_id", "project_id"),
        Index("idx_chat_messages_project_created_at", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="chat_messages")
    user: Mapped[User | None] = relationship(back_populates="chat_messages")


class WeeklyReport(TimestampMixin, Base):
    __tablename__ = "weekly_reports"
    __table_args__ = (
        CheckConstraint("week_end >= week_start", name="weekly_reports_week_check"),
        CheckConstraint("progress_rate BETWEEN 0 AND 100", name="weekly_reports_progress_check"),
        UniqueConstraint("project_id", "week_start", "week_end", name="uq_weekly_reports_project_week"),
        Index("idx_weekly_reports_project_week", "project_id", "week_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    week_end: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    progress_rate: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    project: Mapped[Project] = relationship(back_populates="weekly_reports")
    creator: Mapped[User] = relationship(back_populates="weekly_reports", foreign_keys=[created_by])


class HandoffReport(TimestampMixin, Base):
    __tablename__ = "handoff_reports"
    __table_args__ = (
        CheckConstraint("handoff_score BETWEEN 0 AND 100", name="handoff_reports_score_check"),
        CheckConstraint("jsonb_typeof(missing_items_json) = 'array'", name="handoff_reports_missing_array_check"),
        Index("idx_handoff_reports_project_created_at", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    handoff_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    missing_items_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))

    project: Mapped[Project] = relationship(back_populates="handoff_reports")
    creator: Mapped[User] = relationship(back_populates="handoff_reports", foreign_keys=[created_by])


class AISummary(Base):
    __tablename__ = "ai_summaries"
    __table_args__ = (
        CheckConstraint(
            "summary_type IN ('document_summary', 'meeting_summary', 'project_summary', 'weekly_summary', 'handoff_summary')",
            name="ai_summaries_type_check",
        ),
        CheckConstraint("jsonb_typeof(extracted_json) = 'object'", name="ai_summaries_extracted_object_check"),
        Index("idx_ai_summaries_project_type", "project_id", "summary_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    summary_type: Mapped[str] = mapped_column(String(40), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship(back_populates="ai_summaries")
    document: Mapped[Document | None] = relationship(back_populates="ai_summaries")
