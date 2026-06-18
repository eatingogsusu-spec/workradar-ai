"""Backfill missing document chunk embeddings into PostgreSQL pgvector."""

from __future__ import annotations

import argparse
import asyncio
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


async def load_pending_chunks(limit: int) -> list[dict]:
    limit_clause = "LIMIT :limit" if limit > 0 else ""
    params = {
        "embedding_model": settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
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
    if settings.AI_PROVIDER.lower() != "azure":
        raise RuntimeError("AI_PROVIDER=azure is required")
    if not settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT:
        raise RuntimeError("AZURE_OPENAI_EMBEDDING_DEPLOYMENT is required")
    if settings.EMBEDDING_DIMENSION != 1536:
        raise RuntimeError("Current DB column is vector(1536); set EMBEDDING_DIMENSION=1536")

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
                    model=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
                )
                await db.commit()
                completed += len(batch)
            except Exception as exc:
                await db.rollback()
                await repository.record_failures(
                    chunk_ids=[row["id"] for row in batch],
                    model=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
                    error_message=str(exc),
                )
                await db.commit()
                failed += len(batch)
                print(f"Batch {start // batch_size + 1} failed: {exc}")
        print(f"Progress: completed={completed}, failed={failed}, total={len(chunks)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(backfill(parse_args())))
