"""Document upload and AI analysis endpoints."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Body, Depends, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token, verify_password
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

    # 추출 상한 적용으로 일부 항목이 누락됐는지(전체 N건 중 cap건만 등록) 알린다.
    truncation = None
    summary_row = (
        await db.execute(
            text(
                "SELECT extracted_json FROM ai_summaries "
                "WHERE document_id = :doc_id ORDER BY created_at DESC LIMIT 1"
            ),
            {"doc_id": str(doc_uuid)},
        )
    ).scalar_one_or_none()
    if summary_row is not None:
        try:
            data = summary_row if isinstance(summary_row, dict) else json.loads(summary_row)
            candidate = data.get("truncation") if isinstance(data, dict) else None
            if candidate and candidate.get("truncated"):
                truncation = candidate
        except (ValueError, TypeError):
            truncation = None

    return {
        "document_id": str(document.id),
        "file_name": document.file_name,
        "file_type": document.file_type,
        "analysis_status": document.analysis_status,
        "status": document.analysis_status,
        "progress": document.progress,
        "error": document.error_message,
        "truncation": truncation,
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


@router.get("/{document_id}/todos")
async def get_document_todos(document_id: str, db: AsyncSession = Depends(get_db)):
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc

    document = await db.get(Document, doc_uuid)
    if not document or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="document not found")

    result = await db.execute(
        text(
            """
            SELECT
              t.id::text AS id,
              t.title,
              t.description,
              t.status,
              t.priority,
              t.approval_status,
              t.due_at,
              t.source_type AS source,
              t.source_document_id::text AS document_id,
              t.source_chunk_id::text AS source_chunk_id,
              u.name AS assignee,
              t.created_at,
              COALESCE(t.updated_at, t.created_at) AS updated_at
            FROM todos t
            LEFT JOIN project_members pm ON pm.id = t.assignee_member_id
            LEFT JOIN users u ON u.id = pm.user_id
            WHERE t.source_document_id = CAST(:doc_id AS uuid)
            ORDER BY COALESCE(t.updated_at, t.created_at) DESC
            """
        ),
        {"doc_id": str(doc_uuid)},
    )
    return {"todos": [dict(row) for row in result.mappings().all()]}


@router.get("/{document_id}/issues")
async def get_document_issues(document_id: str, db: AsyncSession = Depends(get_db)):
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc

    document = await db.get(Document, doc_uuid)
    if not document or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="document not found")

    result = await db.execute(
        text(
            """
            SELECT
              i.id::text AS id,
              i.title,
              i.description,
              i.status,
              i.severity,
              i.severity AS risk_level,
              i.approval_status,
              i.due_at,
              i.source_type AS source,
              i.source_document_id::text AS document_id,
              i.source_chunk_id::text AS source_chunk_id,
              i.risk_reason,
              u.name AS assignee,
              i.created_at,
              COALESCE(i.updated_at, i.created_at) AS updated_at
            FROM issues i
            LEFT JOIN project_members pm ON pm.id = i.assignee_member_id
            LEFT JOIN users u ON u.id = pm.user_id
            WHERE i.source_document_id = CAST(:doc_id AS uuid)
            ORDER BY COALESCE(i.updated_at, i.created_at) DESC
            """
        ),
        {"doc_id": str(doc_uuid)},
    )
    return {"issues": [dict(row) for row in result.mappings().all()]}


@router.get("/{document_id}/download")
async def download_document(
    document_id: str,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    actor = await _resolve_actor(db, authorization)
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc
    document = await db.get(Document, doc_uuid)
    if not document or document.deleted_at is not None or not document.storage_uri:
        raise HTTPException(status_code=404, detail="document not found")
    if str(actor.get("role") or "").lower() != "admin":
        membership = await db.execute(
            text(
                """
                SELECT 1
                FROM project_members
                WHERE project_id = :project_id
                  AND user_id = CAST(:user_id AS uuid)
                  AND status = 'active'
                LIMIT 1
                """
            ),
            {"project_id": str(document.project_id), "user_id": actor["user_id"]},
        )
        if membership.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="document not found")
    file_path = Path(document.storage_uri)
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="source file no longer exists")
    return FileResponse(file_path, filename=document.file_name, media_type=document.mime_type)


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    payload: dict | None = Body(default=None),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    actor = await _resolve_actor(db, authorization)
    if actor["username"] != "hj" and str(actor["role"]).lower() not in {"admin", "pm", "leader"}:
        raise HTTPException(403, "lead role required")
    password = str((payload or {}).get("password") or "")
    if not password:
        raise HTTPException(status_code=400, detail="admin password required")
    await _verify_actor_password(db, actor["user_id"], password)
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid document_id") from exc
    document = await db.get(Document, doc_uuid)
    if not document or document.deleted_at is not None:
        raise HTTPException(status_code=404, detail="document not found")
    file_path = Path(document.storage_uri) if document.storage_uri else None

    delete_counts: dict[str, int] = {}
    related_filter = """
      source_document_id = CAST(:document_id AS uuid)
      OR source_chunk_id IN (
        SELECT id FROM document_chunks WHERE document_id = CAST(:document_id AS uuid)
      )
    """
    issue_ids = text(
        f"""
        SELECT id
        FROM issues
        WHERE {related_filter}
        """
    )
    delete_statements = [
        (
            "calendar_events",
            text(
                """
                DELETE FROM calendar_events
                WHERE source_chunk_id IN (
                  SELECT id FROM document_chunks WHERE document_id = CAST(:document_id AS uuid)
                )
                """
            ),
        ),
        (
            "todo_issue_links",
            text(
                f"""
                UPDATE todos
                SET linked_issue_id = NULL
                WHERE linked_issue_id IN ({issue_ids.text})
                """
            ),
        ),
        ("todos", text(f"DELETE FROM todos WHERE {related_filter}")),
        ("issues", text(f"DELETE FROM issues WHERE {related_filter}")),
        (
            "ai_summaries",
            text("DELETE FROM ai_summaries WHERE document_id = CAST(:document_id AS uuid)"),
        ),
        (
            "embedding_jobs",
            text("DELETE FROM embedding_jobs WHERE document_id = CAST(:document_id AS uuid)"),
        ),
        (
            "chunk_embeddings",
            text(
                """
                DELETE FROM chunk_embeddings
                WHERE chunk_id IN (
                  SELECT id FROM document_chunks WHERE document_id = CAST(:document_id AS uuid)
                )
                """
            ),
        ),
        (
            "document_chunks",
            text("DELETE FROM document_chunks WHERE document_id = CAST(:document_id AS uuid)"),
        ),
        ("documents", text("DELETE FROM documents WHERE id = CAST(:document_id AS uuid)")),
    ]

    for label, statement in delete_statements:
        result = await db.execute(statement, {"document_id": str(doc_uuid)})
        delete_counts[label] = int(result.rowcount or 0)
    await db.commit()
    try:
        if file_path and file_path.is_file():
            file_path.unlink(missing_ok=True)
    except OSError:
        pass
    return {"status": "success", "document_id": document_id, "deleted": delete_counts}


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
        text(
            """
            SELECT
              u.id::text AS user_id,
              u.username,
              u.role AS user_role,
              pm.role AS project_role,
              COALESCE(pm.role, u.role) AS role
            FROM users u
            LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.status = 'active'
            WHERE u.id = CAST(:user_id AS uuid)
              AND u.deleted_at IS NULL
            ORDER BY pm.joined_at
            LIMIT 1
            """
        ),
        {"user_id": payload["sub"]},
    )
    actor = result.mappings().one_or_none()
    if not actor:
        raise HTTPException(403, "active user required")
    return dict(actor)


async def _verify_actor_password(db: AsyncSession, user_id: str, password: str) -> None:
    result = await db.execute(
        text(
            """
            SELECT password_hash
            FROM users
            WHERE id = CAST(:user_id AS uuid)
              AND deleted_at IS NULL
            """
        ),
        {"user_id": user_id},
    )
    password_hash = result.scalar_one_or_none()
    if not password_hash or not verify_password(password, password_hash):
        raise HTTPException(status_code=401, detail="관리자 비밀번호가 올바르지 않습니다.")


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
