"""Document upload and AI analysis endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Document
from app.repositories.issue_repository import IssueRepository
from app.repositories.todo_repository import TodoRepository
from app.schemas.document import ChunkIssueCreate, ChunkTodoCreate
from app.services.document_service import create_upload_record, resolve_project_id, run_document_pipeline
from app.services.issue_service import IssueService
from app.services.todo_service import TodoService

router = APIRouter()


@router.post("/upload", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: str | None = Form(default=None),
    doc_type: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
):
    try:
        resolved_project_id = await resolve_project_id(db, project_id)
        document, _ = await create_upload_record(
            db,
            file=file,
            project_id=resolved_project_id,
            doc_type=doc_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    background_tasks.add_task(run_document_pipeline, str(document.id))
    return {
        "status": "queued",
        "document_id": str(document.id),
        "analysis_status": document.analysis_status,
        "progress": document.progress,
    }


@router.get("/{document_id}/status")
async def get_document_status(document_id: str, db: AsyncSession = Depends(get_db)):
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc

    document = await db.get(Document, doc_uuid)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")

    return {
        "document_id": str(document.id),
        "file_name": document.file_name,
        "file_type": document.file_type,
        "analysis_status": document.analysis_status,
        "status": document.analysis_status,
        "progress": document.progress,
        "error": document.error_message,
    }


@router.get("/{document_id}/chunks")
async def get_document_chunks(document_id: str, db: AsyncSession = Depends(get_db)):
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc

    document = await db.get(Document, doc_uuid)
    if not document:
        raise HTTPException(status_code=404, detail="document not found")

    result = await db.execute(
        text(
            """
            SELECT
              id::text AS id,
              document_id::text AS document_id,
              project_id::text AS project_id,
              chunk_index,
              content,
              token_count,
              page_number,
              section_title,
              created_at
            FROM document_chunks
            WHERE document_id = :document_id
            ORDER BY chunk_index
            """
        ),
        {"document_id": str(doc_uuid)},
    )
    return {
        "document": {
            "id": str(document.id),
            "file_name": document.file_name,
            "analysis_status": document.analysis_status,
            "progress": document.progress,
        },
        "chunks": [dict(row) for row in result.mappings().all()],
    }


@router.post("/{document_id}/chunks/{chunk_id}/todos")
async def create_todo_from_chunk(
    document_id: str,
    chunk_id: str,
    body: ChunkTodoCreate,
    db: AsyncSession = Depends(get_db),
):
    payload = body.model_dump(exclude_none=True)
    chunk = await _get_chunk(db, document_id, chunk_id)
    if not chunk:
        raise HTTPException(404, "chunk not found")

    service = TodoService(TodoRepository(db))
    todo_id = await service.create_todo(
        {
            **payload,
            "project_id": chunk["project_id"],
            "source_document_id": chunk["document_id"],
            "source_chunk_id": chunk["id"],
            "description": payload.get("description") or chunk["content"],
            "source": "manual",
            "approval_status": payload.get("approval_status", "approved"),
        }
    )
    return {"status": "success", "todo_id": todo_id, "source_chunk_id": chunk["id"]}


@router.post("/{document_id}/chunks/{chunk_id}/issues")
async def create_issue_from_chunk(
    document_id: str,
    chunk_id: str,
    body: ChunkIssueCreate,
    db: AsyncSession = Depends(get_db),
):
    payload = body.model_dump(exclude_none=True)
    chunk = await _get_chunk(db, document_id, chunk_id)
    if not chunk:
        raise HTTPException(404, "chunk not found")

    service = IssueService(IssueRepository(db))
    issue = await service.create_issue(
        {
            **payload,
            "project_id": chunk["project_id"],
            "source_document_id": chunk["document_id"],
            "source_chunk_id": chunk["id"],
            "description": payload.get("description") or chunk["content"],
            "source": "manual",
            "approval_status": payload.get("approval_status", "approved"),
            "is_candidate": payload.get("is_candidate", False),
        }
    )
    return {"status": "success", "issue": issue, "source_chunk_id": chunk["id"]}


@router.get("")
async def get_documents(project_id: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Document).where(Document.deleted_at.is_(None)).order_by(Document.created_at.desc())
    if project_id:
        query = query.where(Document.project_id == uuid.UUID(project_id))
    result = await db.execute(query)
    documents = result.scalars().all()
    return {
        "documents": [
            {
                "document_id": str(document.id),
                "id": str(document.id),
                "file_name": document.file_name,
                "file_type": document.file_type,
                "analysis_status": document.analysis_status,
                "status": document.analysis_status,
                "progress": document.progress,
                "created_at": document.created_at.isoformat() if document.created_at else None,
            }
            for document in documents
        ]
    }


async def _get_chunk(db: AsyncSession, document_id: str, chunk_id: str) -> dict | None:
    try:
        doc_uuid = uuid.UUID(document_id)
        chunk_uuid = uuid.UUID(chunk_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid document_id or chunk_id")

    result = await db.execute(
        text(
            """
            SELECT
              id::text AS id,
              document_id::text AS document_id,
              project_id::text AS project_id,
              content
            FROM document_chunks
            WHERE id = :chunk_id
              AND document_id = :document_id
            """
        ),
        {"document_id": str(doc_uuid), "chunk_id": str(chunk_uuid)},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None
