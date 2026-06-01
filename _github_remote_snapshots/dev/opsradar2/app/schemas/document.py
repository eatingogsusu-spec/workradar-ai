from pydantic import BaseModel
from typing import Optional


class DocumentUploadResponse(BaseModel):
    status: str
    document_id: str
    file_name: str
    file_type: str
    analysis_status: str


class DocumentStatusResponse(BaseModel):
    document_id: str
    analysis_status: str  # parsing | embedding | completed | failed
    progress: int
