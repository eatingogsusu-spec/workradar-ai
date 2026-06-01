from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class WeeklyReport(Base):
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
    week_start: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    week_end: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    progress_rate: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="weekly_reports")
    creator: Mapped[User] = relationship("User", back_populates="weekly_reports", foreign_keys=[created_by])


class MonthlyReport(Base):
    __tablename__ = "monthly_reports"
    __table_args__ = (
        CheckConstraint("month_end >= month_start", name="monthly_reports_month_check"),
        CheckConstraint("progress_rate BETWEEN 0 AND 100", name="monthly_reports_progress_check"),
        UniqueConstraint("project_id", "month_start", "month_end", name="uq_monthly_reports_project_month"),
        Index("idx_monthly_reports_project_month", "project_id", "month_start"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    month_start: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    month_end: Mapped[datetime] = mapped_column(DateTime(), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    progress_rate: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="monthly_reports")
    creator: Mapped[User] = relationship("User", back_populates="monthly_reports", foreign_keys=[created_by])


class HandoffReport(Base):
    __tablename__ = "handoff_reports"
    __table_args__ = (
        CheckConstraint("handoff_score BETWEEN 0 AND 100", name="handoff_reports_score_check"),
        CheckConstraint("jsonb_typeof(missing_items_json) = 'array'", name="handoff_reports_missing_array_check"),
        Index("idx_handoff_reports_project_created_at", "project_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    handoff_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    missing_items_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(DateTime(), server_default=func.now(), nullable=False)

    project: Mapped[Project] = relationship("Project", back_populates="handoff_reports")
    creator: Mapped[User] = relationship("User", back_populates="handoff_reports", foreign_keys=[created_by])
