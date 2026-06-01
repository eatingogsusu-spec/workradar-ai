"""
Issue 스키마
담당: 박주원
"""
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime


class IssueCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    status: Literal["open", "in_progress", "blocked", "resolved"] = "open"
    assignee: Optional[str] = None
    domino_impact: Optional[str] = None
    source_document: Optional[str] = None


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    risk_level: Optional[str] = None
    assignee: Optional[str] = None


class IssueResponse(BaseModel):
    id: str
    title: str
    description: Optional[str]
    risk_level: str
    status: str
    source: str
    confidence: Optional[str]
    assignee: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
