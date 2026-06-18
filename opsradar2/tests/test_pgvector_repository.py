"""Regression tests for pgvector persistence and retrieval wiring."""

import asyncio
import uuid
from pathlib import Path

import pytest

from app.repositories.embedding_repository import EmbeddingRepository


ROOT = Path(__file__).resolve().parents[1]


class FakeMappings:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeResult:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return FakeMappings(self.rows)


class FakeSession:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.calls = []

    async def execute(self, statement, params=None):
        self.calls.append((str(statement), params))
        return FakeResult(self.rows)


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pgvector_replaces_faiss_in_active_pipeline():
    service = read("app/services/document_service.py")
    retriever = read("app/ai/retriever.py")

    assert "EmbeddingRepository" in service
    assert "FAISSStore().add" not in service
    assert "EmbeddingRepository" in retriever
    assert "FAISSStore().search" not in retriever


def test_repository_rejects_wrong_embedding_dimension():
    repository = EmbeddingRepository(FakeSession(), dimension=3)

    with pytest.raises(ValueError, match="embedding dimension mismatch"):
        asyncio.run(
            repository.save_embeddings(
                chunk_ids=[uuid.uuid4()],
                embeddings=[[0.1, 0.2]],
                model="test-embedding",
            )
        )


def test_search_excludes_deleted_documents_and_supports_scope_filters():
    session = FakeSession(
        [
            {
                "text": "matched",
                "score": 0.9,
                "document_id": str(uuid.uuid4()),
                "project_id": str(uuid.uuid4()),
                "file_name": "source.txt",
                "doc_type": "meeting",
            }
        ]
    )
    repository = EmbeddingRepository(session, dimension=3)
    project_id = uuid.uuid4()
    document_id = uuid.uuid4()

    rows = asyncio.run(
        repository.search(
            [0.1, 0.2, 0.3],
            top_k=3,
            project_id=project_id,
            doc_type="meeting",
            document_id=document_id,
        )
    )

    statement, params = session.calls[0]
    assert "d.deleted_at IS NULL" in statement
    assert "dc.project_id = CAST(:project_id AS uuid)" in statement
    assert "d.id = CAST(:document_id AS uuid)" in statement
    assert "ce.embedding_status = 'completed'" in statement
    assert params["project_id"] == str(project_id)
    assert params["document_id"] == str(document_id)
    assert rows[0]["file_name"] == "source.txt"
