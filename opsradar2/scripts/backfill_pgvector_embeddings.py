"""Backfill missing document chunk embeddings into PostgreSQL pgvector."""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ai.embedder import embed_texts
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.repositories.embedding_repository import EmbeddingRepository


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Write embeddings. Without this flag, only report pending chunks.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Maximum chunks to process; 0 means all.")
    parser.add_argument("--batch-size", type=int, default=16, help="Chunks per database batch.")
    return parser.parse_args()


async def column_dimension() -> int | None:
    """Actual declared dimension of chunk_embeddings.embedding, or None if unknown."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(
                """
                SELECT format_type(a.atttypid, a.atttypmod)
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = :schema
                  AND c.relname = 'chunk_embeddings'
                  AND a.attname = 'embedding'
                """
            ),
            {"schema": settings.DB_SCHEMA},
        )
        formatted = result.scalar_one_or_none()
    if not formatted:
        return None
    match = re.search(r"\((\d+)\)", formatted)
    return int(match.group(1)) if match else None


async def load_pending_chunks(limit: int) -> list[dict]:
    limit_clause = "LIMIT :limit" if limit > 0 else ""
    params = {
        "embedding_model": settings.embedding_model_name,
        "limit": limit,
    }
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(
                f"""
                SELECT dc.id, dc.content, dc.document_id, dc.project_id
                FROM document_chunks dc
                JOIN documents d ON d.id = dc.document_id
                LEFT JOIN chunk_embeddings ce
                  ON ce.chunk_id = dc.id
                 AND ce.embedding_model = :embedding_model
                 AND ce.embedding_status = 'completed'
                 AND ce.embedding IS NOT NULL
                WHERE d.deleted_at IS NULL
                  AND ce.id IS NULL
                ORDER BY d.created_at, dc.chunk_index
                {limit_clause}
                """
            ),
            params,
        )
        return [dict(row) for row in result.mappings().all()]


async def backfill(args: argparse.Namespace) -> int:
    if not settings.embedding_enabled:
        raise RuntimeError("AI_PROVIDER=azure or ollama is required")

    model = settings.embedding_model_name
    if not model:
        raise RuntimeError(
            "No embedding model configured; set OLLAMA_EMBED_MODEL (ollama) "
            "or AZURE_OPENAI_EMBEDDING_DEPLOYMENT (azure)"
        )

    declared = await column_dimension()
    if declared is not None and declared != settings.EMBEDDING_DIMENSION:
        raise RuntimeError(
            f"DB column chunk_embeddings.embedding is vector({declared}) but "
            f"EMBEDDING_DIMENSION={settings.EMBEDDING_DIMENSION}. "
            f"Migrate the column to vector({settings.EMBEDDING_DIMENSION}) or change the setting."
        )

    print(f"Provider={settings.AI_PROVIDER} model={model} dim={settings.EMBEDDING_DIMENSION}")
    chunks = await load_pending_chunks(args.limit)
    print(f"Pending pgvector chunks: {len(chunks)}")
    if not args.execute or not chunks:
        return 0

    batch_size = max(1, args.batch_size or settings.EMBEDDING_BATCH_SIZE)
    completed = 0
    failed = 0
    for start in range(0, len(chunks), batch_size):
        batch = chunks[start : start + batch_size]
        async with AsyncSessionLocal() as db:
            repository = EmbeddingRepository(db, dimension=settings.EMBEDDING_DIMENSION)
            try:
                vectors = await embed_texts([row["content"] for row in batch])
                await repository.save_embeddings(
                    chunk_ids=[row["id"] for row in batch],
                    embeddings=vectors,
                    model=model,
                )
                await db.commit()
                completed += len(batch)
            except Exception as exc:
                await db.rollback()
                await repository.record_failures(
                    chunk_ids=[row["id"] for row in batch],
                    model=model,
                    error_message=str(exc),
                )
                await db.commit()
                failed += len(batch)
                print(f"Batch {start // batch_size + 1} failed: {exc}")
        print(f"Progress: completed={completed}, failed={failed}, total={len(chunks)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(backfill(parse_args())))
