"""create teammemory project-centered schema

Revision ID: 20260513_0001
Revises:
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('admin', 'member')", name="users_role_check"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="active"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('active', 'archived', 'completed')", name="projects_status_check"),
        sa.CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="projects_date_check"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_projects_team_id", "projects", ["team_id"])

    op.create_table(
        "project_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('admin', 'member')", name="project_members_role_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )
    op.create_index("idx_project_members_project_id", "project_members", ["project_id"])
    op.create_index("idx_project_members_user_id", "project_members", ["user_id"])

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", sa.String(length=50), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False, server_default="other"),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="parsing"),
        sa.Column("uploaded_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "source_type IN ('email', 'meeting', 'chat', 'other')",
            name="documents_source_type_check",
        ),
        sa.CheckConstraint("status IN ('parsing', 'embedding', 'completed', 'failed')", name="documents_status_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_documents_project_id", "documents", ["project_id"])
    op.create_index("idx_documents_uploaded_by", "documents", ["uploaded_by"])

    op.create_table(
        "document_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("chunk_index >= 0", name="document_chunks_index_check"),
        sa.CheckConstraint("page_number IS NULL OR page_number > 0", name="document_chunks_page_check"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_document_index"),
    )
    op.create_index("idx_document_chunks_document_id", "document_chunks", ["document_id"])
    op.create_index("idx_document_chunks_project_id", "document_chunks", ["project_id"])

    op.create_table(
        "chunk_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("chunk_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("faiss_index_path", sa.String(length=500), nullable=False),
        sa.Column("faiss_index_id", sa.Integer(), nullable=False),
        sa.Column("embedding_model", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["chunk_id"], ["document_chunks.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("faiss_index_path", "faiss_index_id", name="uq_chunk_embeddings_faiss_ref"),
    )
    op.create_index("idx_chunk_embeddings_chunk_id", "chunk_embeddings", ["chunk_id"])

    op.create_table(
        "todos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_chunk_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("linked_issue_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending"),
        sa.Column("priority", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("source_type", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("approval_status", sa.String(length=50), nullable=False, server_default="approved"),
        sa.Column("confidence_score", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('pending', 'in_progress', 'completed')", name="todos_status_check"),
        sa.CheckConstraint("priority IN ('low', 'medium', 'high')", name="todos_priority_check"),
        sa.CheckConstraint("source_type IN ('manual', 'ai')", name="todos_source_type_check"),
        sa.CheckConstraint("approval_status IN ('pending', 'approved', 'rejected')", name="todos_approval_status_check"),
        sa.CheckConstraint("confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100", name="todos_confidence_score_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["source_document_id"], ["documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_chunk_id"], ["document_chunks.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_todos_project_id", "todos", ["project_id"])
    op.create_index("idx_todos_assignee_id", "todos", ["assignee_id"])
    op.create_index("idx_todos_status", "todos", ["status"])
    op.create_index("idx_todos_source_type", "todos", ["source_type"])
    op.create_index("idx_todos_approval_status", "todos", ["approval_status"])
    op.create_index("idx_todos_due_date", "todos", ["due_date"])
    op.create_index("idx_todos_project_due_date", "todos", ["project_id", "due_date"])
    op.create_index("idx_todos_project_approval", "todos", ["project_id", "approval_status"])

    op.create_table(
        "issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="open"),
        sa.Column("source_type", sa.String(length=20), nullable=False, server_default="manual"),
        sa.Column("confidence_score", sa.Integer(), nullable=True),
        sa.Column("is_candidate", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("severity IN ('low', 'medium', 'high')", name="issues_severity_check"),
        sa.CheckConstraint("status IN ('open', 'in_progress', 'resolved')", name="issues_status_check"),
        sa.CheckConstraint("source_type IN ('ai', 'manual')", name="issues_source_type_check"),
        sa.CheckConstraint("confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100", name="issues_confidence_score_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_document_id"], ["documents.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_issues_project_id", "issues", ["project_id"])
    op.create_index("idx_issues_status", "issues", ["status"])
    op.create_index("idx_issues_severity", "issues", ["severity"])
    op.create_index("idx_issues_project_status", "issues", ["project_id", "status"])
    op.create_index("idx_issues_project_severity", "issues", ["project_id", "severity"])
    op.create_index("idx_issues_project_candidate", "issues", ["project_id", "is_candidate"])
    op.create_foreign_key("fk_todos_linked_issue_id", "todos", "issues", ["linked_issue_id"], ["id"], ondelete="SET NULL")

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sources_json", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('user', 'assistant')", name="chat_messages_role_check"),
        sa.CheckConstraint("jsonb_typeof(sources_json) = 'array'", name="chat_messages_sources_array_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_chat_messages_project_id", "chat_messages", ["project_id"])
    op.create_index("idx_chat_messages_project_created_at", "chat_messages", ["project_id", "created_at"])

    op.create_table(
        "weekly_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("week_start", sa.DateTime(), nullable=False),
        sa.Column("week_end", sa.DateTime(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("progress_rate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("week_end >= week_start", name="weekly_reports_week_check"),
        sa.CheckConstraint("progress_rate BETWEEN 0 AND 100", name="weekly_reports_progress_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("project_id", "week_start", "week_end", name="uq_weekly_reports_project_week"),
    )
    op.create_index("idx_weekly_reports_project_week", "weekly_reports", ["project_id", "week_start"])

    op.create_table(
        "monthly_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("month_start", sa.DateTime(), nullable=False),
        sa.Column("month_end", sa.DateTime(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("progress_rate", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("month_end >= month_start", name="monthly_reports_month_check"),
        sa.CheckConstraint("progress_rate BETWEEN 0 AND 100", name="monthly_reports_progress_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("project_id", "month_start", "month_end", name="uq_monthly_reports_project_month"),
    )
    op.create_index("idx_monthly_reports_project_month", "monthly_reports", ["project_id", "month_start"])

    op.create_table(
        "handoff_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("handoff_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("missing_items_json", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("handoff_score BETWEEN 0 AND 100", name="handoff_reports_score_check"),
        sa.CheckConstraint("jsonb_typeof(missing_items_json) = 'array'", name="handoff_reports_missing_array_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("idx_handoff_reports_project_created_at", "handoff_reports", ["project_id", "created_at"])

    op.create_table(
        "ai_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("summary_type", sa.String(length=50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("extracted_json", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "summary_type IN ('weekly', 'monthly')",
            name="ai_summaries_type_check",
        ),
        sa.CheckConstraint("jsonb_typeof(extracted_json) = 'object'", name="ai_summaries_extracted_object_check"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="SET NULL"),
    )
    op.create_index("idx_ai_summaries_project_type", "ai_summaries", ["project_id", "summary_type"])


def downgrade() -> None:
    op.drop_index("idx_ai_summaries_project_type", table_name="ai_summaries")
    op.drop_table("ai_summaries")
    op.drop_index("idx_handoff_reports_project_created_at", table_name="handoff_reports")
    op.drop_table("handoff_reports")
    op.drop_index("idx_monthly_reports_project_month", table_name="monthly_reports")
    op.drop_table("monthly_reports")
    op.drop_index("idx_weekly_reports_project_week", table_name="weekly_reports")
    op.drop_table("weekly_reports")
    op.drop_index("idx_chat_messages_project_created_at", table_name="chat_messages")
    op.drop_index("idx_chat_messages_project_id", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_constraint("fk_todos_linked_issue_id", "todos", type_="foreignkey")
    op.drop_index("idx_issues_project_severity", table_name="issues")
    op.drop_index("idx_issues_project_candidate", table_name="issues")
    op.drop_index("idx_issues_project_status", table_name="issues")
    op.drop_index("idx_issues_severity", table_name="issues")
    op.drop_index("idx_issues_status", table_name="issues")
    op.drop_index("idx_issues_project_id", table_name="issues")
    op.drop_table("issues")
    op.drop_index("idx_todos_project_due_date", table_name="todos")
    op.drop_index("idx_todos_project_approval", table_name="todos")
    op.drop_index("idx_todos_due_date", table_name="todos")
    op.drop_index("idx_todos_approval_status", table_name="todos")
    op.drop_index("idx_todos_source_type", table_name="todos")
    op.drop_index("idx_todos_status", table_name="todos")
    op.drop_index("idx_todos_assignee_id", table_name="todos")
    op.drop_index("idx_todos_project_id", table_name="todos")
    op.drop_table("todos")
    op.drop_index("idx_chunk_embeddings_chunk_id", table_name="chunk_embeddings")
    op.drop_table("chunk_embeddings")
    op.drop_index("idx_document_chunks_project_id", table_name="document_chunks")
    op.drop_index("idx_document_chunks_document_id", table_name="document_chunks")
    op.drop_table("document_chunks")
    op.drop_index("idx_documents_uploaded_by", table_name="documents")
    op.drop_index("idx_documents_project_id", table_name="documents")
    op.drop_table("documents")
    op.drop_index("idx_project_members_user_id", table_name="project_members")
    op.drop_index("idx_project_members_project_id", table_name="project_members")
    op.drop_table("project_members")
    op.drop_index("idx_projects_team_id", table_name="projects")
    op.drop_table("projects")
    op.drop_table("teams")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
