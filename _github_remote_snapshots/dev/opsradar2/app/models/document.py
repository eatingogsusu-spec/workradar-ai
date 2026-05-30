"""
담당: 김성호
"""
from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50))          # email | meeting | chat | other
    analysis_status = Column(String(50))    # parsing | embedding | completed | failed
    progress = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
