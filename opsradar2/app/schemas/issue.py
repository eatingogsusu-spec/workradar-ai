"""
Issue 스키마
담당: 박주원
"""
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional
from datetime import datetime

IssueSeverity = Literal["low", "medium", "high", "critical"]
IssueStatus = Literal["open", "in_progress", "blocked", "resolved"]
ApprovalStatus = Literal["pending", "approved", "rejected", "needs_revision"]


class IssueCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: Optional[str] = None
    severity: IssueSeverity = "medium"
    status: IssueStatus = "open"
    assignee: Optional[str] = None
    domino_impact: Optional[str] = None
    source_document: Optional[str] = None
    project_id: Optional[str] = None
    source: Optional[str] = "manual"
    approval_status: ApprovalStatus = "approved"
    confidence: Optional[int] = None
    is_candidate: bool = False
    risk_reason: Optional[str] = None
    source_document_id: Optional[str] = None
    source_chunk_id: Optional[str] = None
    reporter: Optional[str] = None


class IssueUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    status: Optional[IssueStatus] = None
    severity: Optional[IssueSeverity] = None
    risk_level: Optional[IssueSeverity] = None
    assignee: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = None


class IssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: Optional[str]
    risk_level: str
    status: str
    source: str
    confidence: Optional[str]
    assignee: Optional[str]
    created_at: datetime
