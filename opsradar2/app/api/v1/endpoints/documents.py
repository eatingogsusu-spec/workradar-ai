"""Document upload and AI analysis endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
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
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    try:
        resolved_project_id = await resolve_project_id(db, project_id)
        uploaded_by_member_id = await _resolve_uploaded_by_member_id(db, authorization, resolved_project_id)
        document, _ = await create_upload_record(
            db,
            file=file,
            project_id=resolved_project_id,
            doc_type=doc_type,
            uploaded_by_member_id=uploaded_by_member_id,
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
    filters = ["d.deleted_at IS NULL"]
    params: dict[str, str] = {}
    if project_id:
        filters.append("d.project_id = CAST(:project_id AS uuid)")
        params["project_id"] = project_id
    result = await db.execute(
        text(
            f"""
            SELECT
              d.id::text AS id,
              d.file_name,
              d.file_type,
              d.analysis_status,
              d.progress,
              d.created_at,
              u.name AS uploaded_by,
              COUNT(DISTINCT t.id) FILTER (
                WHERE t.approval_status = 'pending'
              ) AS pending_todo_count,
              COUNT(DISTINCT i.id) FILTER (
                WHERE i.approval_status = 'pending'
              ) AS pending_issue_count,
              COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'blocked')
                + COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'blocked') AS blocked_count
            FROM documents d
            LEFT JOIN project_members pm ON pm.id = d.uploaded_by_member_id
            LEFT JOIN users u ON u.id = pm.user_id
            LEFT JOIN todos t ON t.source_document_id = d.id
            LEFT JOIN issues i ON i.source_document_id = d.id
            WHERE {" AND ".join(filters)}
            GROUP BY d.id, u.name
            ORDER BY d.created_at DESC
            """
        ),
        params,
    )
    documents = result.mappings().all()
    return {
        "documents": [
            {
                "document_id": document["id"],
                "id": document["id"],
                "file_name": document["file_name"],
                "file_type": document["file_type"],
                "analysis_status": document["analysis_status"],
                "status": document["analysis_status"],
                "progress": document["progress"],
                "created_at": document["created_at"].isoformat() if document["created_at"] else None,
                "uploaded_by": document["uploaded_by"],
                "pending_todo_count": int(document["pending_todo_count"] or 0),
                "pending_issue_count": int(document["pending_issue_count"] or 0),
                "blocked_count": int(document["blocked_count"] or 0),
            }
            for document in documents
        ]
    }


@router.get("/{document_id}/download")
async def download_document(document_id: str, db: AsyncSession = Depends(get_db)):
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc
    document = await db.get(Document, doc_uuid)
    if not document or document.deleted_at is not None or not document.storage_uri:
        raise HTTPException(status_code=404, detail="document not found")
    file_path = Path(document.storage_uri)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="source file no longer exists")
    return FileResponse(file_path, filename=document.file_name, media_type=document.mime_type)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    actor = await _resolve_actor(db, authorization)
    if actor["username"] != "hj" and str(actor["role"]).lower() not in {"admin", "pm", "leader"}:
        raise HTTPException(403, "lead role required")
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc
    document = await db.get(Document, doc_uuid)
    if not document or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="document not found")
    file_path = Path(document.storage_uri) if document.storage_uri else None
    document.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    if file_path and file_path.is_file():
        file_path.unlink(missing_ok=True)
    return {"status": "success", "document_id": document_id}


async def _resolve_uploaded_by_member_id(
    db: AsyncSession,
    authorization: str | None,
    project_id: uuid.UUID,
) -> uuid.UUID | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = decode_access_token(authorization.split(" ", 1)[1])
    user_id = payload.get("sub") if payload else None
    if not user_id:
        return None
    result = await db.execute(
        text(
            """
            SELECT id
            FROM project_members
            WHERE project_id = :project_id
              AND user_id = CAST(:user_id AS uuid)
              AND status = 'active'
            LIMIT 1
            """
        ),
        {"project_id": project_id, "user_id": user_id},
    )
    return result.scalar_one_or_none()


async def _resolve_actor(db: AsyncSession, authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "login required")
    payload = decode_access_token(authorization.split(" ", 1)[1])
    if not payload or not payload.get("sub"):
        raise HTTPException(401, "invalid token")
    result = await db.execute(
        text("SELECT username, role FROM users WHERE id = CAST(:user_id AS uuid) AND deleted_at IS NULL"),
        {"user_id": payload["sub"]},
    )
    actor = result.mappings().one_or_none()
    if not actor:
        raise HTTPException(403, "active user required")
    return dict(actor)


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
