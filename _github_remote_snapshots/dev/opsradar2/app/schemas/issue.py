from pydantic import BaseModel
from typing import Optional


class IssueUpdate(BaseModel):
    status: Optional[str] = None
    assignee: Optional[str] = None


class IssueResponse(BaseModel):
    issue_id: str
    title: str
    risk_level: str
    status: str
    source: str
    confidence: Optional[str]
    assignee: Optional[str]
    document_id: Optional[str]
    created_at: str
