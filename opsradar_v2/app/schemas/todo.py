from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TodoBase(BaseModel):
    project_id: UUID
    title: str = Field(max_length=200)
    description: str | None = None
    status: str = "todo"
    priority: str = "medium"
    due_date: datetime | None = None


class TodoCreate(TodoBase):
    created_by: UUID
    assignee_id: UUID | None = None


class TodoRead(TodoBase):
    id: UUID
    assignee_id: UUID | None = None
    created_by: UUID
    linked_issue_id: UUID | None = None
    source_type: str
    approval_status: str
    confidence_score: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
