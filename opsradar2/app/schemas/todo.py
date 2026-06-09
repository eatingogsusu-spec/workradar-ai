from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


TodoStatus = Literal["pending", "in_progress", "blocked", "completed"]
TodoPriority = Literal["low", "medium", "high", "critical"]
ApprovalStatus = Literal["pending", "approved", "rejected", "needs_revision"]


class TodoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1)
    description: Optional[str] = None
    status: TodoStatus = "pending"
    priority: TodoPriority = "medium"
    assignee: Optional[str] = None
    approval_status: ApprovalStatus = "approved"
    due_at: Optional[str] = None
    source: Optional[str] = "manual"
    project_id: Optional[str] = None
    confidence: Optional[int] = None
    linked_issue_id: Optional[str] = None
    source_document_id: Optional[str] = None
    source_chunk_id: Optional[str] = None
    created_by: Optional[str] = None


class TodoUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    status: Optional[TodoStatus] = None
    priority: Optional[TodoPriority] = None
    assignee: Optional[str] = None
    approval_status: Optional[ApprovalStatus] = None
    due_at: Optional[str] = None


class TodoResponse(BaseModel):
    todo_id: str
    title: str
    status: str
    priority: str
    assignee: Optional[str]
    source: str
    confidence: Optional[int]
    document_id: Optional[str]
    source_file_name: Optional[str] = None
    source_uploaded_at: Optional[str] = None
    created_at: str
