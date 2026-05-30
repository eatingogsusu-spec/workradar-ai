"""
담당: 김성호
"""
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True)
    period = Column(String(20))   # daily | weekly | monthly
    start_date = Column(String(20))
    end_date = Column(String(20))
    content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
