"""Report, chat, and AI summary models aligned with the current OpsRadar2 schema."""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func

from app.core.database import Base


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    created_by_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    content = Column(Text, nullable=True)
    progress_rate = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    created_by_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    month_start = Column(Date, nullable=False)
    month_end = Column(Date, nullable=False)
    content = Column(Text, nullable=True)
    progress_rate = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class HandoffReport(Base):
    __tablename__ = "handoff_reports"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    from_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    to_member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    handoff_type = Column(String(50), nullable=False, default="general")
    content = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    member_id = Column(UUID(as_uuid=True), ForeignKey("project_members.id"), nullable=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    sources_json = Column(JSONB, nullable=True)
    model_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AISummary(Base):
    __tablename__ = "ai_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    source_faiss_index_id = Column(UUID(as_uuid=True), ForeignKey("faiss_indexes.id"), nullable=True)
    todo_count = Column(Integer, nullable=False, default=0)
    issue_count = Column(Integer, nullable=False, default=0)
    blocked_count = Column(Integer, nullable=False, default=0)
    summary = Column(Text, nullable=True)
    extracted_json = Column(JSONB, nullable=True)
    model_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
