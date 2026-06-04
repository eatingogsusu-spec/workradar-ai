"""Document chunking helpers for AI retrieval."""

from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Any


CHUNK_SIZE = 700
CHUNK_OVERLAP = 100


def chunk_text(
    text: str,
    *,
    doc_type: str = "report",
    metadata: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    metadata = metadata or {}
    if doc_type == "csv":
        chunks = _chunk_csv(text, metadata)
    elif doc_type in {"meeting", "handover", "chat", "email"}:
        chunks = _chunk_structured(text, metadata)
    else:
        chunks = _chunk_default(text, metadata)
    return chunks or _chunk_default(text, metadata)


def chunk_file(file_path: str | Path, *, doc_type: str = "report", metadata: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    from app.ai.file_parser import parse_file

    text, inferred_type = parse_file(file_path)
    return chunk_text(text, doc_type=doc_type or inferred_type, metadata=metadata)


def _chunk_csv(text: str, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    chunks = []
    for index, row in enumerate(reader):
        row_text = " / ".join(f"{key}: {value}" for key, value in row.items() if value)
        if row_text.strip():
            chunks.append(_make_chunk(row_text, index, metadata, "csv_row"))
    return chunks


def _chunk_structured(text: str, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    parts = [
        part.strip()
        for part in re.split(r"\n(?:---+|===SECTION_END===|===ISSUE_END===)\n", text)
        if part.strip()
    ]
    if len(parts) <= 1:
        return _chunk_default(text, metadata)
    return [_make_chunk(part, index, metadata, "section") for index, part in enumerate(parts)]


def _chunk_default(text: str, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    normalized = re.sub(r"\s+", " ", text).strip()
    if not normalized:
        return []

    chunks = []
    start = 0
    index = 0
    while start < len(normalized):
        end = min(start + CHUNK_SIZE, len(normalized))
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(_make_chunk(chunk, index, metadata, "text"))
            index += 1
        if end >= len(normalized):
            break
        start = max(0, end - CHUNK_OVERLAP)
    return chunks


def _make_chunk(text: str, index: int, metadata: dict[str, Any], chunk_type: str) -> dict[str, Any]:
    return {
        "text": text,
        "metadata": {
            **metadata,
            "chunk_index": index,
            "chunk_type": chunk_type,
        },
    }
