"""
Calendar 모델
담당: 박주원
"""
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(String(36), primary_key=True)
    title = Column(String(255), nullable=False)
    event_date = Column(String(20))       # 2026-05-26
    event_type = Column(String(50))       # absence / meeting / deadline
    person = Column(String(100))          # 담당자
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())