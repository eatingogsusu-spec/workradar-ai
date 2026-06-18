"""PostgreSQL pgvector persistence and similarity search."""

from __future__ import annotations

import math
import uuid
from typing import Any, Sequence

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class EmbeddingRepository:
    """Store and search document chunk embeddings in PostgreSQL."""

    def __init__(self, db: AsyncSession, *, dimension: int):
        self.db = db
        self.dimension = dimension

    async def create_job(
        self,
        *,
        project_id: uuid.UUID,
        document_id: uuid.UUID,
    ) -> uuid.UUID:
        result = await self.db.execute(
            text(
                """
                INSERT INTO embedding_jobs (
                    project_id, document_id, job_type, status, started_at
                )
                VALUES (
                    :project_id, :document_id, 'document', 'running', now()
                )
                RETURNING id
                """
            ),
            {"project_id": project_id, "document_id": document_id},
        )
        return result.scalar_one()

    async def finish_job(
        self,
        job_id: uuid.UUID,
        *,
        status: str,
        error_message: str | None = None,
    ) -> None:
        if status not in {"completed", "failed"}:
            raise ValueError("embedding job status must be completed or failed")
        await self.db.execute(
            text(
                """
                UPDATE embedding_jobs
                SET status = :status,
                    error_message = :error_message,
                    finished_at = now()
                WHERE id = :job_id
                """
            ),
            {
                "job_id": job_id,
                "status": status,
                "error_message": error_message[:4000] if error_message else None,
            },
        )

    async def save_embeddings(
        self,
        *,
        chunk_ids: Sequence[uuid.UUID],
        embeddings: Sequence[Sequence[float]],
        model: str,
    ) -> None:
        if len(chunk_ids) != len(embeddings):
            raise ValueError("chunk_ids and embeddings must have equal lengths")
        if not chunk_ids:
            return

        params = [
            {
                "chunk_id": chunk_id,
                "embedding": self._vector_literal(vector),
                "embedding_model": model,
                "embedding_dimension": self.dimension,
            }
            for chunk_id, vector in zip(chunk_ids, embeddings)
        ]
        await self.db.execute(
            text(
                """
                INSERT INTO chunk_embeddings (
                    chunk_id,
                    embedding,
                    embedding_model,
                    embedding_dimension,
                    embedding_status,
                    error_message,
                    updated_at
                )
                VALUES (
                    :chunk_id,
                    CAST(:embedding AS vector),
                    :embedding_model,
                    :embedding_dimension,
                    'completed',
                    NULL,
                    now()
                )
                ON CONFLICT (chunk_id, embedding_model)
                DO UPDATE SET
                    embedding = EXCLUDED.embedding,
                    embedding_dimension = EXCLUDED.embedding_dimension,
                    embedding_status = 'completed',
                    error_message = NULL,
                    updated_at = now()
                """
            ),
            params,
        )

    async def record_failures(
        self,
        *,
        chunk_ids: Sequence[uuid.UUID],
        model: str,
        error_message: str,
    ) -> None:
        if not chunk_ids:
            return
        params = [
            {
                "chunk_id": chunk_id,
                "embedding_model": model,
                "embedding_dimension": self.dimension,
                "error_message": error_message[:4000],
            }
            for chunk_id in chunk_ids
        ]
        await self.db.execute(
            text(
                """
                INSERT INTO chunk_embeddings (
                    chunk_id,
                    embedding,
                    embedding_model,
                    embedding_dimension,
                    embedding_status,
                    error_message,
                    updated_at
                )
                VALUES (
                    :chunk_id,
                    NULL,
                    :embedding_model,
                    :embedding_dimension,
                    'failed',
                    :error_message,
                    now()
                )
                ON CONFLICT (chunk_id, embedding_model)
                DO UPDATE SET
                    embedding = NULL,
                    embedding_dimension = EXCLUDED.embedding_dimension,
                    embedding_status = 'failed',
                    error_message = EXCLUDED.error_message,
                    updated_at = now()
                """
            ),
            params,
        )

    async def search(
        self,
        query_embedding: Sequence[float],
        *,
        top_k: int,
        project_id: str | uuid.UUID | None = None,
        doc_type: str | None = None,
        document_id: str | uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        vector = self._vector_literal(query_embedding)
        filters = [
            "ce.embedding IS NOT NULL",
            "ce.embedding_status = 'completed'",
            "d.deleted_at IS NULL",
        ]
        params: dict[str, Any] = {"embedding": vector, "top_k": top_k}

        if project_id:
            filters.append("dc.project_id = CAST(:project_id AS uuid)")
            params["project_id"] = str(project_id)
        if doc_type:
            filters.append("d.file_type = :doc_type")
            params["doc_type"] = doc_type
        if document_id:
            filters.append("d.id = CAST(:document_id AS uuid)")
            params["document_id"] = str(document_id)

        result = await self.db.execute(
            text(
                f"""
                SELECT
                    dc.content AS text,
                    1 - (ce.embedding <=> CAST(:embedding AS vector)) AS score,
                    d.id::text AS document_id,
                    d.project_id::text AS project_id,
                    d.file_name,
                    d.file_type AS doc_type,
                    dc.chunk_index,
                    dc.page_number,
                    dc.section_title
                FROM chunk_embeddings ce
                JOIN document_chunks dc ON dc.id = ce.chunk_id
                JOIN documents d ON d.id = dc.document_id
                WHERE {" AND ".join(filters)}
                ORDER BY ce.embedding <=> CAST(:embedding AS vector)
                LIMIT :top_k
                """
            ),
            params,
        )
        return [dict(row) for row in result.mappings().all()]

    def _vector_literal(self, vector: Sequence[float]) -> str:
        if len(vector) != self.dimension:
            raise ValueError(
                f"embedding dimension mismatch: expected {self.dimension}, got {len(vector)}"
            )
        values = [float(value) for value in vector]
        if not all(math.isfinite(value) for value in values):
            raise ValueError("embedding contains a non-finite value")
        return "[" + ",".join(format(value, ".17g") for value in values) + "]"
