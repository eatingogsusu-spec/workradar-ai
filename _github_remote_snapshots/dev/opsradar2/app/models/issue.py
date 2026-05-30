"""
담당: 김성호
"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Issue(Base):
    __tablename__ = "issues"

    id = Column(String(36), primary_key=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    risk_level = Column(String(20))   # high | medium | low
    status = Column(String(50))       # open | in_progress | resolved
    source = Column(String(20))       # ai | manual
    confidence = Column(String(10))   # AI 신뢰도 (후보 이슈용)
    assignee = Column(String(100))
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
