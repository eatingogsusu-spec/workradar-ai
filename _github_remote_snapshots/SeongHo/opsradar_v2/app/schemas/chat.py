from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ChatRequest(BaseModel):
    project_id: UUID
    user_id: UUID | None = None
    message: str


class ChatMessageRead(BaseModel):
    id: UUID
    project_id: UUID
    user_id: UUID | None = None
    role: str
    content: str
    sources_json: list[dict]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict] = []
