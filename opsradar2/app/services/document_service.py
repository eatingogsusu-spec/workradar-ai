"""Document upload, parsing, chunking, and AI extraction pipeline."""

from __future__ import annotations

import json
import asyncio
import uuid
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
from app.models import Document, DocumentChunk, Issue, Project, Todo
from app.vectorstores.faiss_store import FAISSStore


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
) -> tuple[Document, Path]:
    document_id = uuid.uuid4()
    safe_name = Path(file.filename or "upload.txt").name
    save_path = UPLOAD_DIR / f"{document_id}_{safe_name}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    await _save_upload_file(file.file, save_path, settings.MAX_UPLOAD_BYTES)

    document = Document(
        id=document_id,
        project_id=project_id,
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
            if settings.AI_PROVIDER.lower() == "azure":
                try:
                    texts = [chunk["text"] for chunk in chunks]
                    embeddings = await embed_texts(texts)
                    metadatas = [chunk["metadata"] for chunk in chunks]
                    FAISSStore().add(texts, embeddings, metadatas)
                except Exception as exc:
                    notes.append(f"embedding skipped: {exc}")
            else:
                notes.append("embedding skipped: AI_PROVIDER is not azure")

            await _update_document(db, document, analysis_status="analyzing", progress=85)
            summary = await summarize_document(text)
            extracted = await extract_todos(text)
            await _create_extracted_items(db, document, extracted, chunk_rows)
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


async def _create_extracted_items(
    db: AsyncSession,
    document: Document,
    extracted: dict,
    chunk_rows: list[DocumentChunk] | None = None,
) -> None:
    source_chunk_id = chunk_rows[0].id if chunk_rows else None

    for item in extracted.get("todos", [])[:20]:
        title = item.get("content") or item.get("title")
        if title:
            db.add(
                Todo(
                    id=uuid.uuid4(),
                    project_id=document.project_id,
                    source_document_id=document.id,
                    source_chunk_id=source_chunk_id,
                    title=str(title)[:500],
                    description=str(title),
                    status="pending",
                    priority=item.get("priority") or "medium",
                    source_type="ai",
                    approval_status="pending",
                    confidence_score=80,
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
