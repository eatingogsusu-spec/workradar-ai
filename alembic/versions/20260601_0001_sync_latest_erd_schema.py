"""sync latest erd schema

Revision ID: 20260601_0001
Revises:
Create Date: 2026-06-01
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "20260601_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.CheckConstraint("role IN ('admin', 'pm', 'member', 'backend', 'frontend', 'ai', 'infra', 'viewer')", name="users_role_check"),
    )
    op.create_index("idx_users_team_id", "users", ["team_id"])
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.String(1000)),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.CheckConstraint("status IN ('planning', 'active', 'in_progress', 'completed', 'archived')", name="projects_status_check"),
    )
    op.create_index("idx_projects_team_id", "projects", ["team_id"])
    op.create_table(
        "project_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="member"),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )
    op.create_index("idx_project_members_team_id", "project_members", ["team_id"])
    op.create_index("idx_project_members_project_id", "project_members", ["project_id"])
    op.create_index("idx_project_members_user_id", "project_members", ["user_id"])
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_by_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(50), nullable=False),
        sa.Column("storage_uri", sa.String(1000), nullable=False),
        sa.Column("content_hash", sa.String(128)),
        sa.Column("status", sa.String(50), nullable=False, server_default="uploaded"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by_member_id"], ["project_members.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_documents_project_id", "documents", ["project_id"])
    op.create_index("idx_documents_uploaded_by_member_id", "documents", ["uploaded_by_member_id"])
    op.create_index("idx_documents_status", "documents", ["status"])
    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer()),
        sa.Column("content_hash", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_document_index"),
    )
    op.create_index("idx_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_table(
        "faiss_indexes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("index_path", sa.String(1000), nullable=False),
        sa.Column("embedding_model", sa.String(100), nullable=False),
        sa.Column("embedding_dimension", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(50), nullable=False, server_default="building"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("activated_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("project_id", "version", name="uq_faiss_indexes_project_version"),
    )
    op.create_index("idx_faiss_indexes_project_id", "faiss_indexes", ["project_id"])
    op.create_table(
        "chunk_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("faiss_index_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("vector_external_id", sa.Integer(), nullable=False),
        sa.Column("embedding_model", sa.String(100), nullable=False),
        sa.Column("embedding_dimension", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["chunk_id"], ["document_chunks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["faiss_index_id"], ["faiss_indexes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("faiss_index_id", "vector_external_id", name="uq_chunk_embeddings_faiss_vector"),
    )
    op.create_index("idx_chunk_embeddings_chunk_id", "chunk_embeddings", ["chunk_id"])
    op.create_index("idx_chunk_embeddings_faiss_index_id", "chunk_embeddings", ["faiss_index_id"])
    op.create_table(
        "embedding_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True)),
        sa.Column("faiss_index_id", postgresql.UUID(as_uuid=True)),
        sa.Column("job_type", sa.String(50), nullable=False, server_default="document_embedding"),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("error_message", sa.Text()),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["faiss_index_id"], ["faiss_indexes.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_embedding_jobs_project_id", "embedding_jobs", ["project_id"])
    op.create_index("idx_embedding_jobs_document_id", "embedding_jobs", ["document_id"])
    op.create_index("idx_embedding_jobs_faiss_index_id", "embedding_jobs", ["faiss_index_id"])
    op.create_index("idx_embedding_jobs_status", "embedding_jobs", ["status"])

    _create_ops_tables()


def _create_ops_tables() -> None:
    op.create_table(
        "todos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assignee_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("source_chunk_id", postgresql.UUID(as_uuid=True)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("priority", sa.String(50), nullable=False, server_default="medium"),
        sa.Column("source_type", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="approved"),
        sa.Column("confidence_score", sa.Integer()),
        sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_member_id"], ["project_members.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_chunk_id"], ["document_chunks.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_todos_project_status", "todos", ["project_id", "status"])
    op.create_index("idx_todos_project_approval", "todos", ["project_id", "approval_status"])
    op.create_index("idx_todos_assignee_member_id", "todos", ["assignee_member_id"])
    op.create_index("idx_todos_due_at", "todos", ["due_at"])
    op.create_table(
        "issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assignee_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("source_chunk_id", postgresql.UUID(as_uuid=True)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("severity", sa.String(50), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column("source_type", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="confirmed"),
        sa.Column("confidence_score", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_member_id"], ["project_members.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_chunk_id"], ["document_chunks.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_issues_project_status", "issues", ["project_id", "status"])
    op.create_index("idx_issues_project_severity", "issues", ["project_id", "severity"])
    op.create_index("idx_issues_project_approval", "issues", ["project_id", "approval_status"])
    op.create_table(
        "issue_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("changed_by_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("note", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["issue_id"], ["issues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by_member_id"], ["project_members.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_issue_history_issue_id", "issue_history", ["issue_id"])
    op.create_index("idx_issue_history_changed_by_member_id", "issue_history", ["changed_by_member_id"])
    op.create_table(
        "calendar_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("source_chunk_id", postgresql.UUID(as_uuid=True)),
        sa.Column("event_type", sa.String(50), nullable=False, server_default="other"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("approval_status", sa.String(50), nullable=False, server_default="approved"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["project_members.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_chunk_id"], ["document_chunks.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_calendar_events_project_starts", "calendar_events", ["project_id", "starts_at"])
    op.create_index("idx_calendar_events_member_id", "calendar_events", ["member_id"])
    op.create_table(
        "weekly_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("progress_rate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_member_id"], ["project_members.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("project_id", "week_start", "week_end", name="uq_weekly_reports_project_week"),
    )
    op.create_index("idx_weekly_reports_project_week", "weekly_reports", ["project_id", "week_start"])
    op.create_table(
        "monthly_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("month_start", sa.Date(), nullable=False),
        sa.Column("month_end", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("progress_rate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_member_id"], ["project_members.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("project_id", "month_start", "month_end", name="uq_monthly_reports_project_month"),
    )
    op.create_index("idx_monthly_reports_project_month", "monthly_reports", ["project_id", "month_start"])
    op.create_table(
        "handoff_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("to_member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("handoff_type", sa.String(50), nullable=False, server_default="project"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_member_id"], ["project_members.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_member_id"], ["project_members.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_handoff_reports_project_created", "handoff_reports", ["project_id", "created_at"])
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("member_id", postgresql.UUID(as_uuid=True)),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["member_id"], ["project_members.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_chat_messages_project_created", "chat_messages", ["project_id", "created_at"])
    op.create_index("idx_chat_messages_member_id", "chat_messages", ["member_id"])
    op.create_table(
        "ai_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True)),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_faiss_index_id", postgresql.UUID(as_uuid=True)),
        sa.Column("todo_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("issue_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocked_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_faiss_index_id"], ["faiss_indexes.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_ai_summaries_project_id", "ai_summaries", ["project_id"])
    op.create_index("idx_ai_summaries_document_id", "ai_summaries", ["document_id"])


def downgrade() -> None:
    for table in [
        "ai_summaries",
        "chat_messages",
        "handoff_reports",
        "monthly_reports",
        "weekly_reports",
        "calendar_events",
        "issue_history",
        "issues",
        "todos",
        "embedding_jobs",
        "chunk_embeddings",
        "faiss_indexes",
        "document_chunks",
        "documents",
        "project_members",
        "projects",
        "users",
        "teams",
    ]:
        op.drop_table(table)
