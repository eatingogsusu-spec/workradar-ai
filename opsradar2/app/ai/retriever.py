"""RAG retrieval helpers."""

from __future__ import annotations

from typing import Any

from app.ai.embedder import embed_text
from app.vectorstores.faiss_store import FAISSStore


SCORE_THRESHOLD = 0.41


async def retrieve(query: str, *, top_k: int = 3, doc_type: str | None = None, document_id: str | None = None) -> list[dict[str, Any]]:
    if not query.strip():
        raise ValueError("query is required")
    if not 1 <= top_k <= 10:
        raise ValueError("top_k must be between 1 and 10")

    embedding = await embed_text(query)
    results = FAISSStore().search(embedding, top_k=top_k, doc_type=doc_type, document_id=document_id)
    return [result for result in results if result.get("score", 0) >= SCORE_THRESHOLD]


def build_context(results: list[dict[str, Any]]) -> str:
    parts = []
    for result in results:
        source = result.get("source") or result.get("file_name") or "unknown"
        parts.append(f"[source: {source}]\n{result.get('text', '')}")
    return "\n\n".join(parts)
