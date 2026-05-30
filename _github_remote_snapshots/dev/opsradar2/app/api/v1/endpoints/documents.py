"""UC-01 document upload and processing status endpoints."""

from fastapi import APIRouter, File, Form, UploadFile

router = APIRouter()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    file_type: str = Form(...),
):
    """Upload a document and start the AI processing pipeline."""
    # TODO: Persist document metadata.
    # TODO: Trigger ai.file_parser, ai.chunker, and ai.embedder.
    return {"status": "success", "document_id": "doc_001", "analysis_status": "parsing"}


@router.get("/{document_id}/status")
async def get_document_status(document_id: str):
    """Return document processing status."""
    # TODO: Read document status from document_repository.
    return {"document_id": document_id, "analysis_status": "embedding", "progress": 60}


@router.get("")
async def get_documents():
    """List uploaded documents."""
    # TODO: Read documents from document_repository.
    return {"documents": []}

