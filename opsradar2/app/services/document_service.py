"""Document AI pipeline service."""

from __future__ import annotations

import shutil
import uuid
import json
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chunker import chunk_text
from app.ai.embedder import embed_texts
from app.ai.file_parser import parse_file
from app.ai.llm_client import AzureOpenAIConfigError
from app.ai.summarizer import extract_todos, summarize_document
from app.core.config import PROJECT_ROOT, settings
from app.core.database import AsyncSessionLocal
from app.models import Document, DocumentChunk, Issue, Project, Todo
from app.vectorstores.faiss_store import FAISSStore


UPLOAD_DIR = PROJECT_ROOT / "uploads"


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

    with save_path.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    document = Document(
        id=document_id,
        project_id=project_id,
        file_name=safe_name,
        file_type=doc_type or save_path.suffix.lstrip(".") or "other",
        mime_type=file.content_type,
        storage_uri=str(save_path),
        analysis_status="uploaded",
        progress=0,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document, save_path


async def run_document_pipeline(document_id: str) -> None:
    async with AsyncSessionLocal() as db:
        document = await db.get(Document, uuid.UUID(document_id))
        if not document:
            return
        try:
            await _update_document(db, document, analysis_status="parsing", progress=10)
            text, inferred_type = parse_file(document.storage_uri)
            doc_type = document.file_type or inferred_type

            await _update_document(db, document, analysis_status="chunking", progress=35, file_type=doc_type)
            chunks = chunk_text(
                text,
                doc_type=doc_type,
                metadata={
                    "document_id": str(document.id),
                    "project_id": str(document.project_id),
                    "file_name": document.file_name,
                    "source": document.file_name,
                    "doc_type": doc_type,
                },
            )

            chunk_rows = []
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
            embedding_note = None
            if settings.AI_PROVIDER.lower() == "azure":
                try:
                    texts = [chunk["text"] for chunk in chunks]
                    embeddings = await embed_texts(texts)
                    metadatas = [chunk["metadata"] for chunk in chunks]
                    FAISSStore().add(texts, embeddings, metadatas)
                except Exception as exc:
                    embedding_note = f"embedding skipped: {exc}"
            else:
                embedding_note = "embedding skipped: AI_PROVIDER is not azure"

            await _update_document(db, document, analysis_status="analyzing", progress=85)
            if settings.AI_PROVIDER.lower() != "disabled":
                summary = await summarize_document(text)
                extracted = await extract_todos(text)
                await _create_extracted_items(db, document, extracted)
                await _create_ai_summary(db, document, summary, extracted)

            await _update_document(
                db,
                document,
                analysis_status="completed",
                progress=100,
                error_message=embedding_note,
            )
        except Exception as exc:
            await _update_document(
                db,
                document,
                analysis_status="failed",
                progress=0,
                error_message=str(exc),
            )


async def _create_extracted_items(db: AsyncSession, document: Document, extracted: dict) -> None:
    for item in extracted.get("todos", [])[:20]:
        title = item.get("content") or item.get("title")
        if title:
            db.add(Todo(
                id=uuid.uuid4(),
                project_id=document.project_id,
                source_document_id=document.id,
                title=title[:500],
                description=title,
                source_type="ai",
                approval_status="pending",
                confidence_score=80,
            ))
    for item in extracted.get("issues", [])[:20]:
        title = item.get("title") or item.get("description")
        if title:
            db.add(Issue(
                id=uuid.uuid4(),
                project_id=document.project_id,
                source_document_id=document.id,
                title=title[:500],
                description=item.get("description"),
                severity=item.get("severity", "medium"),
                source_type="ai",
                approval_status="pending",
                confidence_score=80,
                is_candidate=True,
            ))
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
