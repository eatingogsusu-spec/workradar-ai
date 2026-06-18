"""RAG retrieval helpers."""

from __future__ import annotations

from typing import Any

from app.ai.embedder import embed_text
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.repositories.embedding_repository import EmbeddingRepository


SCORE_THRESHOLD = 0.41


async def retrieve(
    query: str,
    *,
    top_k: int = 3,
    project_id: str | None = None,
    doc_type: str | None = None,
    document_id: str | None = None,
) -> list[dict[str, Any]]:
    if not query.strip():
        raise ValueError("query is required")
    if not 1 <= top_k <= 10:
        raise ValueError("top_k must be between 1 and 10")

    embedding = await embed_text(query)
    async with AsyncSessionLocal() as db:
        results = await EmbeddingRepository(
            db,
            dimension=settings.EMBEDDING_DIMENSION,
        ).search(
            embedding,
            top_k=top_k,
            project_id=project_id,
            doc_type=doc_type,
            document_id=document_id,
        )

    normalized = []
    for result in results:
        result["score"] = round(float(result.get("score") or 0), 4)
        result["source"] = result.get("file_name") or ""
        result["metadata"] = {
            "document_id": result.get("document_id"),
            "project_id": result.get("project_id"),
            "file_name": result.get("file_name"),
            "doc_type": result.get("doc_type"),
            "chunk_index": result.get("chunk_index"),
            "page_number": result.get("page_number"),
            "section_title": result.get("section_title"),
        }
        if result["score"] >= SCORE_THRESHOLD:
            normalized.append(result)
    return normalized


def build_context(results: list[dict[str, Any]]) -> str:
    parts = []
    for result in results:
        source = result.get("source") or result.get("file_name") or "unknown"
        parts.append(f"[source: {source}]\n{result.get('text', '')}")
    return "\n\n".join(parts)
