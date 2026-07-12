"""Backfill document_chunks for documents that were seeded without chunking.

The seed inserts `documents` rows only, so the RAG tables downstream of them
(document_chunks -> chunk_embeddings) start empty. This re-parses each document's
storage_uri and writes chunks, without running the LLM analysis that
run_document_pipeline() also does. Run backfill_pgvector_embeddings.py afterwards
to fill in the vectors.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.ai.chunker import chunk_text
from app.ai.file_parser import parse_file
from app.core.config import PROJECT_ROOT, settings
from app.core.database import AsyncSessionLocal

# storage_uri is stored relative to the repo root (e.g. "dummy_data/02_raw_documents/..."),
# which is the parent of PROJECT_ROOT (opsradar2/).
SEARCH_BASES = (Path.cwd(), PROJECT_ROOT, PROJECT_ROOT.parent)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Write chunks. Without this flag, only report what would be chunked.",
    )
    parser.add_argument("--limit", type=int, default=0, help="Maximum documents to process; 0 means all.")
    return parser.parse_args()


def resolve_storage_path(storage_uri: str) -> Path | None:
    candidate = Path(storage_uri)
    if candidate.is_absolute():
        return candidate if candidate.exists() else None
    for base in SEARCH_BASES:
        resolved = base / candidate
        if resolved.exists():
            return resolved
    return None


async def load_unchunked_documents(limit: int) -> list[dict]:
    limit_clause = "LIMIT :limit" if limit > 0 else ""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(
                f"""
                SELECT d.id, d.project_id, d.file_name, d.file_type, d.storage_uri
                FROM documents d
                LEFT JOIN document_chunks dc ON dc.document_id = d.id
                WHERE d.deleted_at IS NULL
                  AND d.storage_uri IS NOT NULL
                  AND dc.id IS NULL
                GROUP BY d.id
                ORDER BY d.created_at
                {limit_clause}
                """
            ),
            {"limit": limit},
        )
        return [dict(row) for row in result.mappings().all()]


async def backfill(args: argparse.Namespace) -> int:
    documents = await load_unchunked_documents(args.limit)
    print(f"Documents without chunks: {len(documents)}")
    if not args.execute or not documents:
        return 0

    chunked = 0
    total_chunks = 0
    missing: list[str] = []
    failed: list[str] = []

    for document in documents:
        path = resolve_storage_path(document["storage_uri"])
        if path is None:
            missing.append(f"{document['file_name']} ({document['storage_uri']})")
            continue

        try:
            content, inferred_type = parse_file(path)
            doc_type = inferred_type or document["file_type"] or "report"
            chunks = chunk_text(
                content,
                doc_type=doc_type,
                metadata={
                    "document_id": str(document["id"]),
                    "project_id": str(document["project_id"]),
                    "file_name": document["file_name"],
                    "source": document["file_name"],
                    "doc_type": doc_type,
                },
            )
        except Exception as exc:
            failed.append(f"{document['file_name']}: {exc}")
            continue

        if not chunks:
            failed.append(f"{document['file_name']}: produced no chunks")
            continue

        rows = [
            {
                "id": uuid.uuid4(),
                "document_id": document["id"],
                "project_id": document["project_id"],
                "chunk_index": index,
                "content": chunk["text"],
                "token_count": len(chunk["text"].split()),
                "section_title": (
                    chunk.get("metadata", {}).get("section_title")
                    or chunk.get("metadata", {}).get("chunk_type")
                ),
            }
            for index, chunk in enumerate(chunks)
        ]

        async with AsyncSessionLocal() as db:
            await db.execute(
                text(
                    """
                    INSERT INTO document_chunks (
                        id, document_id, project_id, chunk_index,
                        content, token_count, section_title
                    )
                    VALUES (
                        :id, :document_id, :project_id, :chunk_index,
                        :content, :token_count, :section_title
                    )
                    ON CONFLICT (document_id, chunk_index) DO NOTHING
                    """
                ),
                rows,
            )
            await db.commit()

        chunked += 1
        total_chunks += len(rows)
        print(f"Chunked {document['file_name']}: {len(rows)} chunks")

    print(f"\nDocuments chunked: {chunked}, chunks written: {total_chunks}")
    if missing:
        print(f"Missing source files ({len(missing)}):")
        for entry in missing:
            print(f"  - {entry}")
    if failed:
        print(f"Failed ({len(failed)}):")
        for entry in failed:
            print(f"  - {entry}")
    return 1 if (missing or failed) else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(backfill(parse_args())))
