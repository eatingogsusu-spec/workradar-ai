"""Document upload, parsing, chunking, and AI extraction pipeline."""

from __future__ import annotations

import json
import asyncio
import uuid
from datetime import datetime, time
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chunker import chunk_text
from app.ai.embedder import embed_texts
from app.ai.file_parser import infer_doc_type, parse_file
from app.ai.summarizer import extract_todos, summarize_document
from app.core.config import PROJECT_ROOT, settings
from app.core.database import AsyncSessionLocal
from app.models import Document, DocumentChunk, Issue, Project, ProjectMember, Todo, User
from app.repositories.embedding_repository import EmbeddingRepository


UPLOAD_DIR = PROJECT_ROOT / "uploads"
DB_DOCUMENT_FILE_TYPES = {"email", "meeting", "chat", "issue_log", "other"}
UPLOAD_CHUNK_BYTES = 1024 * 1024


def normalize_db_file_type(value: str | None, filename: str | None = None) -> str:
    """Map upload/parser hints to values allowed by documents.file_type."""
    raw = (value or "").strip().lower()
    if raw in DB_DOCUMENT_FILE_TYPES:
        return raw

    name = (filename or "").lower()
    if any(token in name for token in ("meeting", "minutes", "회의", "회의록")):
        return "meeting"
    if any(token in name for token in ("chat", "slack", "채팅", "대화")):
        return "chat"
    if any(token in name for token in ("email", "mail", "메일")):
        return "email"
    if any(token in name for token in ("issue", "incident", "error", "ops", "log", "운영", "로그", "장애", "이슈")):
        return "issue_log"
    return "other"


async def resolve_project_id(db: AsyncSession, project_id: str | None) -> uuid.UUID:
    if project_id:
        return uuid.UUID(project_id)
    result = await db.execute(select(Project.id).limit(1))
    existing = result.scalar_one_or_none()
    if existing:
        return existing
    raise ValueError("project_id is required when no project exists")


async def create_upload_record(
    db: AsyncSession,
    *,
    file: UploadFile,
    project_id: uuid.UUID,
    doc_type: str | None = None,
    uploaded_by_member_id: uuid.UUID | None = None,
) -> tuple[Document, Path]:
    document_id = uuid.uuid4()
    safe_name = Path(file.filename or "upload.txt").name
    save_path = UPLOAD_DIR / f"{document_id}_{safe_name}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    await _save_upload_file(file.file, save_path, settings.MAX_UPLOAD_BYTES)

    document = Document(
        id=document_id,
        project_id=project_id,
        uploaded_by_member_id=uploaded_by_member_id,
        file_name=safe_name,
        file_type=normalize_db_file_type(doc_type or infer_doc_type(safe_name), safe_name),
        mime_type=file.content_type,
        storage_uri=str(save_path),
        analysis_status="uploaded",
        progress=0,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document, save_path


async def _save_upload_file(source: BinaryIO, save_path: Path, max_bytes: int) -> None:
    await asyncio.to_thread(_copy_upload_file_with_limit, source, save_path, max_bytes)


def _copy_upload_file_with_limit(source: BinaryIO, save_path: Path, max_bytes: int) -> None:
    total = 0
    source.seek(0)
    try:
        with save_path.open("wb") as output:
            while chunk := source.read(UPLOAD_CHUNK_BYTES):
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError(f"file is too large; max upload size is {max_bytes} bytes")
                output.write(chunk)
    except Exception:
        save_path.unlink(missing_ok=True)
        raise


async def run_document_pipeline(document_id: str) -> None:
    async with AsyncSessionLocal() as db:
        document = await db.get(Document, uuid.UUID(document_id))
        if not document:
            return
        try:
            await _update_document(db, document, analysis_status="parsing", progress=10)
            text, inferred_type = parse_file(document.storage_uri)
            analysis_doc_type = inferred_type or document.file_type or "report"
            db_file_type = normalize_db_file_type(document.file_type or inferred_type, document.file_name)

            await _update_document(db, document, analysis_status="chunking", progress=35, file_type=db_file_type)
            chunks = chunk_text(
                text,
                doc_type=analysis_doc_type,
                metadata={
                    "document_id": str(document.id),
                    "project_id": str(document.project_id),
                    "file_name": document.file_name,
                    "source": document.file_name,
                    "doc_type": analysis_doc_type,
                    "db_file_type": db_file_type,
                },
            )

            chunk_rows: list[DocumentChunk] = []
            for index, chunk in enumerate(chunks):
                metadata = chunk.get("metadata", {})
                row = DocumentChunk(
                    id=uuid.uuid4(),
                    document_id=document.id,
                    project_id=document.project_id,
                    chunk_index=index,
                    content=chunk["text"],
                    token_count=len(chunk["text"].split()),
                    section_title=metadata.get("section_title") or metadata.get("chunk_type"),
                )
                db.add(row)
                chunk_rows.append(row)
            await db.commit()

            await _update_document(db, document, analysis_status="embedding", progress=65)
            notes: list[str] = []
            embedding_repository = EmbeddingRepository(
                db,
                dimension=settings.EMBEDDING_DIMENSION,
            )
            embedding_model = settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT or "unconfigured"
            embedding_job_id = await embedding_repository.create_job(
                project_id=document.project_id,
                document_id=document.id,
            )
            await db.commit()
            if settings.embedding_enabled:
                try:
                    texts = [chunk["text"] for chunk in chunks]
                    embeddings = await embed_texts(texts)
                    await embedding_repository.save_embeddings(
                        chunk_ids=[row.id for row in chunk_rows],
                        embeddings=embeddings,
                        model=embedding_model,
                    )
                    await embedding_repository.finish_job(
                        embedding_job_id,
                        status="completed",
                    )
                    await db.commit()
                except Exception as exc:
                    error_message = str(exc)
                    await db.rollback()
                    await embedding_repository.record_failures(
                        chunk_ids=[row.id for row in chunk_rows],
                        model=embedding_model,
                        error_message=error_message,
                    )
                    await embedding_repository.finish_job(
                        embedding_job_id,
                        status="failed",
                        error_message=error_message,
                    )
                    await db.commit()
                    notes.append(f"embedding failed: {error_message}")
            else:
                error_message = "embedding provider not configured (AI_PROVIDER)"
                await embedding_repository.record_failures(
                    chunk_ids=[row.id for row in chunk_rows],
                    model=embedding_model,
                    error_message=error_message,
                )
                await embedding_repository.finish_job(
                    embedding_job_id,
                    status="failed",
                    error_message=error_message,
                )
                await db.commit()
                notes.append(f"embedding failed: {error_message}")

            await _update_document(db, document, analysis_status="analyzing", progress=85)
            summary = await summarize_document(text)
            extracted = await extract_todos(text)
            await _create_extracted_items(db, document, extracted, chunk_rows, text)
            await _create_ai_summary(db, document, summary, extracted)

            await _update_document(
                db,
                document,
                analysis_status="completed",
                progress=100,
                error_message="; ".join(notes) if notes else None,
            )
        except Exception as exc:
            await _update_document(
                db,
                document,
                analysis_status="failed",
                progress=0,
                error_message=str(exc),
            )


async def _resolve_assignee_member_ids(
    db: AsyncSession, project_id, names: list,
) -> dict[str, str]:
    """추출된 담당자 '이름' → project_members.id 매핑.

    안전 규칙:
    - 해당 프로젝트의 *활성* 멤버 중 그 이름이 **정확히 한 명**일 때만 매핑한다.
    - 이름이 없거나(0명) 동명이인(2명 이상)이면 매핑에서 제외 → 호출부에서 None 폴백.
    """
    wanted = {str(n).strip() for n in names if n and str(n).strip()}
    if not wanted:
        return {}
    rows = (
        await db.execute(
            text(
                """
                SELECT u.name AS name, pm.id::text AS member_id
                FROM project_members pm
                JOIN users u ON u.id = pm.user_id
                WHERE pm.project_id = :project_id
                  AND pm.status = 'active'
                  AND u.deleted_at IS NULL
                  AND u.name IS NOT NULL
                """
            ),
            {"project_id": project_id},
        )
    ).mappings().all()
    counts: dict[str, int] = {}
    first: dict[str, str] = {}
    for row in rows:
        name = str(row["name"]).strip()
        if name not in wanted:
            continue
        counts[name] = counts.get(name, 0) + 1
        first.setdefault(name, row["member_id"])
    return {name: member_id for name, member_id in first.items() if counts[name] == 1}


async def _create_extracted_items(
    db: AsyncSession,
    document: Document,
    extracted: dict,
    chunk_rows: list[DocumentChunk] | None = None,
    source_text: str = "",
) -> None:
    source_chunk_id = chunk_rows[0].id if chunk_rows else None

    def grounded_due_at(value: object) -> datetime | None:
        raw = str(value or "")[:10]
        try:
            return datetime.combine(datetime.strptime(raw, "%Y-%m-%d").date(), time.min)
        except ValueError:
            return None

    todo_items = extracted.get("todos", [])[:20]
    assignee_member_map = await _resolve_assignee_member_ids(
        db, document.project_id, [item.get("assignee") for item in todo_items]
    )
    for item in todo_items:
        title = item.get("title") or item.get("content")
        if title:
            description = item.get("description") or item.get("content") or str(title)
            assignee_name = str(item.get("assignee") or "").strip()
            # [작업1 + main 근거] resolver(_resolve_assignee_member_ids)로 이름→member_id 매핑(동명이인 모호 시 제외)
            # 하되, 원문(source_text)에 이름이 실제로 등장할 때만 배정(main 근거 기반 정책 유지).
            assignee_member_id = (
                assignee_member_map.get(assignee_name)
                if assignee_name and assignee_name in source_text
                else None
            )
            db.add(
                Todo(
                    id=uuid.uuid4(),
                    project_id=document.project_id,
                    created_by_member_id=document.uploaded_by_member_id,
                    source_document_id=document.id,
                    source_chunk_id=source_chunk_id,
                    assignee_member_id=assignee_member_id,
                    title=str(title)[:500],
                    description=str(description),
                    status="pending",
                    priority=item.get("priority") or "medium",
                    source_type="ai",
                    approval_status="pending",
                    confidence_score=80,
                    due_at=grounded_due_at(item.get("due_date")),
                )
            )

    for item in extracted.get("issues", [])[:20]:
        title = item.get("title") or item.get("description")
        if title:
            db.add(
                Issue(
                    id=uuid.uuid4(),
                    project_id=document.project_id,
                    source_document_id=document.id,
                    source_chunk_id=source_chunk_id,
                    title=str(title)[:500],
                    description=item.get("description") or str(title),
                    severity=item.get("severity", "medium"),
                    risk_reason=item.get("reason") or None,
                    status="open",
                    source_type="ai",
                    approval_status="pending",
                    confidence_score=80,
                    is_candidate=True,
                )
            )
    await db.commit()


async def _create_ai_summary(db: AsyncSession, document: Document, summary: str | dict, extracted: dict) -> None:
    summary_text = summary.get("summary") if isinstance(summary, dict) else summary
    if not summary_text:
        summary_text = ""
    truncation = extracted.get("truncation") if isinstance(extracted, dict) else None
    if truncation and truncation.get("truncated"):
        cap = truncation.get("cap", 20)
        parts = []
        if (truncation.get("todos_total") or 0) > cap:
            parts.append(f"Todo 전체 {truncation['todos_total']}건 중 {cap}건")
        if (truncation.get("issues_total") or 0) > cap:
            parts.append(f"Issue 전체 {truncation['issues_total']}건 중 {cap}건")
        if parts:
            note = "⚠️ 항목이 많아 상한을 적용했습니다: " + ", ".join(parts) + "만 등록(나머지 미등록)."
            summary_text = f"{note}\n{summary_text}" if summary_text else note
    todos = extracted.get("todos", [])
    issues = extracted.get("issues", [])
    blocked = [
        item for item in todos + issues
        if str(item.get("status", "")).lower() == "blocked"
        or "blocked" in str(item.get("title") or item.get("content") or "").lower()
    ]
    await db.execute(
        text(
            """
            INSERT INTO ai_summaries (
              id, document_id, project_id, source_faiss_index_id,
              todo_count, issue_count, blocked_count, summary,
              extracted_json, model_name, created_at
            ) VALUES (
              gen_random_uuid(), :document_id, :project_id, NULL,
              :todo_count, :issue_count, :blocked_count, :summary,
              CAST(:extracted_json AS jsonb), :model_name, now()
            )
            """
        ),
        {
            "document_id": document.id,
            "project_id": document.project_id,
            "todo_count": len(todos),
            "issue_count": len(issues),
            "blocked_count": len(blocked),
            "summary": str(summary_text),
            "extracted_json": json.dumps(extracted, ensure_ascii=False),
            "model_name": f"{settings.AI_PROVIDER}:summary",
        },
    )
    await db.commit()


async def _update_document(db: AsyncSession, document: Document, **values) -> None:
    for key, value in values.items():
        setattr(document, key, value)
    await db.commit()
    await db.refresh(document)
