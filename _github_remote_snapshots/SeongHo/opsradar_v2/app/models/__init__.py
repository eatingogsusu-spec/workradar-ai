from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin', 'member')", name="users_role_check"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, server_default="member")

    created_projects: Mapped[list[Project]] = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    project_memberships: Mapped[list[ProjectMember]] = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")
    uploaded_documents: Mapped[list[Document]] = relationship("Document", back_populates="uploader", foreign_keys="Document.uploaded_by")
    assigned_todos: Mapped[list[Todo]] = relationship("Todo", back_populates="assignee", foreign_keys="Todo.assignee_id")
    created_todos: Mapped[list[Todo]] = relationship("Todo", back_populates="creator", foreign_keys="Todo.created_by")
    reviewed_todos: Mapped[list[Todo]] = relationship("Todo", back_populates="reviewer", foreign_keys="Todo.reviewed_by")
    reported_issues: Mapped[list[Issue]] = relationship("Issue", back_populates="reporter", foreign_keys="Issue.reporter_id")
    assigned_issues: Mapped[list[Issue]] = relationship("Issue", back_populates="assignee", foreign_keys="Issue.assignee_id")
    chat_messages: Mapped[list[ChatMessage]] = relationship("ChatMessage", back_populates="user")
    weekly_reports: Mapped[list[WeeklyReport]] = relationship("WeeklyReport", back_populates="creator", foreign_keys="WeeklyReport.created_by")
    monthly_reports: Mapped[list[MonthlyReport]] = relationship("MonthlyReport", back_populates="creator", foreign_keys="MonthlyReport.created_by")
    handoff_reports: Mapped[list[HandoffReport]] = relationship("HandoffReport", back_populates="creator", foreign_keys="HandoffReport.created_by")


class Team(TimestampMixin, Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    projects: Mapped[list[Project]] = relationship("Project", back_populates="team", cascade="all, delete-orphan")


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
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), nullable=False, server_default="active")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)

    team: Mapped[Team] = relationship("Team", back_populates="projects")
    creator: Mapped[User] = relationship("User", back_populates="created_projects", foreign_keys=[created_by])
    members: Mapped[list[ProjectMember]] = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    documents: Mapped[list[Document]] = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    document_chunks: Mapped[list[DocumentChunk]] = relationship("DocumentChunk", back_populates="project", cascade="all, delete-orphan")
    todos: Mapped[list[Todo]] = relationship("Todo", back_populates="project", cascade="all, delete-orphan")
    issues: Mapped[list[Issue]] = relationship("Issue", back_populates="project", cascade="all, delete-orphan")
    chat_messages: Mapped[list[ChatMessage]] = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan")
    weekly_reports: Mapped[list[WeeklyReport]] = relationship("WeeklyReport", back_populates="project", cascade="all, delete-orphan")
    monthly_reports: Mapped[list[MonthlyReport]] = relationship("MonthlyReport", back_populates="project", cascade="all, delete-orphan")
    handoff_reports: Mapped[list[HandoffReport]] = relationship("HandoffReport", back_populates="project", cascade="all, delete-orphan")
    ai_summaries: Mapped[list[AISummary]] = relationship("AISummary", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'member')", name="project_members_role_check"),
        UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
        Index("idx_project_members_project_id", "project_id"),
        Index("idx_project_members_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, server_default="member")
    joined_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="members")
    user: Mapped[User] = relationship("User", back_populates="project_memberships")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name="chat_messages_role_check"),
        CheckConstraint("jsonb_typeof(sources_json) = 'array'", name="chat_messages_sources_array_check"),
        Index("idx_chat_messages_project_id", "project_id"),
        Index("idx_chat_messages_project_created_at", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="chat_messages")
    user: Mapped[User | None] = relationship("User", back_populates="chat_messages")


class AISummary(Base):
    __tablename__ = "ai_summaries"
    __table_args__ = (
        CheckConstraint(
            "summary_type IN ('weekly', 'monthly')",
            name="ai_summaries_type_check",
        ),
        CheckConstraint("jsonb_typeof(extracted_json) = 'object'", name="ai_summaries_extracted_object_check"),
        Index("idx_ai_summaries_project_type", "project_id", "summary_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    document_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"))
    summary_type: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    extracted_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="ai_summaries")
    document: Mapped[Document | None] = relationship("Document", back_populates="ai_summaries")


from app.models.chunk import ChunkEmbedding, DocumentChunk
from app.models.document import Document
from app.models.issue import Issue
from app.models.report import HandoffReport, MonthlyReport, WeeklyReport
from app.models.todo import Todo

__all__ = [
    "AISummary",
    "Base",
    "ChatMessage",
    "ChunkEmbedding",
    "Document",
    "DocumentChunk",
    "HandoffReport",
    "Issue",
    "MonthlyReport",
    "Project",
    "ProjectMember",
    "Team",
    "TimestampMixin",
    "Todo",
    "User",
    "WeeklyReport",
]
