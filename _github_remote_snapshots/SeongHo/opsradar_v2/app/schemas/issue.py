from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class IssueBase(BaseModel):
    project_id: UUID
    title: str = Field(max_length=200)
    description: str | None = None
    severity: str = "medium"
    status: str = "open"


class IssueCreate(IssueBase):
    reporter_id: UUID | None = None
    assignee_id: UUID | None = None
    source_document_id: UUID | None = None


class IssueRead(IssueBase):
    id: UUID
    reporter_id: UUID | None = None
    assignee_id: UUID | None = None
    source_document_id: UUID | None = None
    source_type: str
    confidence_score: int | None = None
    is_candidate: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
