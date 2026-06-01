"""
담당: 김성호
"""
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Todo(Base):
    __tablename__ = "todos"

    id = Column(String(36), primary_key=True)
    title = Column(String(500), nullable=False)
    status = Column(String(50), default="pending")  # pending | in_progress | completed
    priority = Column(String(20))                   # high | medium | low
    assignee = Column(String(100))
    source = Column(String(20))                     # ai | manual
    confidence = Column(Integer)                    # AI 신뢰도 0~100
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    linked_issue_id = Column(String(36), ForeignKey("issues.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
