from pydantic import BaseModel
from pydantic import ConfigDict
from typing import Literal, Optional
from datetime import datetime


class ChunkTodoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: Optional[str] = None
    status: Literal["pending", "in_progress", "completed"] = "pending"
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    assignee: Optional[str] = None
    approval_status: Literal["pending", "approved", "rejected"] = "approved"
    due_at: Optional[str] = None


class ChunkIssueCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    description: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    status: Literal["open", "in_progress", "blocked", "resolved"] = "open"
    assignee: Optional[str] = None
    approval_status: Literal["pending", "approved", "rejected"] = "approved"
    domino_impact: Optional[str] = None
    risk_reason: Optional[str] = None
    is_candidate: bool = False


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    file_name: str
    file_type: Optional[str]
    analysis_status: str
    progress: int
    created_at: datetime
