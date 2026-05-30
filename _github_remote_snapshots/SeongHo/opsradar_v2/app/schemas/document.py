from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    project_id: UUID
    file_name: str
    file_type: str
    source_type: str = "upload"


class DocumentCreate(DocumentBase):
    uploaded_by: UUID
    storage_path: str


class DocumentRead(DocumentBase):
    id: UUID
    uploaded_by: UUID
    storage_path: str
    status: str
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)
