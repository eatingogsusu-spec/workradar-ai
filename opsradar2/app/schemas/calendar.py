"""
Calendar 스키마
담당: 박주원
"""
from pydantic import BaseModel
from typing import Optional


class CalendarEventCreate(BaseModel):
    title: str
    event_date: str
    event_type: str = "meeting"
    person: Optional[str] = None
    description: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    event_type: Optional[str] = None
    person: Optional[str] = None
    description: Optional[str] = None