"""Small FAISS vector store wrapper used by the AI pipeline."""

from __future__ import annotations

import os
import pickle
import shutil
from pathlib import Path
from typing import Any

import numpy as np

from app.core.config import settings


class FAISSStore:
    def __init__(self, faiss_dir: str | Path | None = None):
        self.faiss_dir = Path(faiss_dir or settings.FAISS_INDEX_PATH).parent
        self.index_path = self.faiss_dir / "index.faiss"
        self.texts_path = self.faiss_dir / "texts.pkl"
        self.metadatas_path = self.faiss_dir / "metadatas.pkl"

    def add(self, texts: list[str], embeddings: list[list[float]], metadatas: list[dict[str, Any]]) -> int:
        if not (len(texts) == len(embeddings) == len(metadatas)):
            raise ValueError("texts, embeddings, and metadatas must have equal lengths")
        if not texts:
            raise ValueError("nothing to store")

        import faiss

        vectors = np.array(embeddings, dtype=np.float32)
        self.faiss_dir.mkdir(parents=True, exist_ok=True)

        if self.index_path.exists():
            index = faiss.read_index(str(self.index_path))
            existing_texts, existing_metadatas = self._load_payload()
            index.add(vectors)
            existing_texts.extend(texts)
            existing_metadatas.extend(metadatas)
        else:
            index = faiss.IndexFlatL2(vectors.shape[1])
            index.add(vectors)
            existing_texts = list(texts)
            existing_metadatas = list(metadatas)

        faiss.write_index(index, str(self.index_path))
        self._save_payload(existing_texts, existing_metadatas)
        return int(index.ntotal)

    def search(self, query_embedding: list[float], *, top_k: int = 3, doc_type: str | None = None, document_id: str | None = None) -> list[dict[str, Any]]:
        if not 1 <= top_k <= 50:
            raise ValueError("top_k must be between 1 and 50")
        self._ensure_exists()

        import faiss

        texts, metadatas = self._load_payload()
        index = faiss.read_index(str(self.index_path))
        query_vector = np.array([query_embedding], dtype=np.float32)
        search_k = min(top_k * 10 if (doc_type or document_id) else top_k, index.ntotal)
        distances, indices = index.search(query_vector, search_k)

        results = []
        for distance, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            metadata = metadatas[idx]
            if doc_type and metadata.get("doc_type") != doc_type:
                continue
            if document_id and str(metadata.get("document_id")) != str(document_id):
                continue
            score = round(float(1 / (1 + distance)), 4)
            results.append({
                "text": texts[idx],
                "score": score,
                "metadata": metadata,
                "source": metadata.get("source") or metadata.get("file_name", ""),
                "file_name": metadata.get("file_name") or metadata.get("source", ""),
                "document_id": metadata.get("document_id"),
                "doc_type": metadata.get("doc_type", ""),
            })
            if len(results) >= top_k:
                break
        return results

    def count(self) -> int:
        if not self.index_path.exists():
            return 0
        import faiss

        return int(faiss.read_index(str(self.index_path)).ntotal)

    def exists(self) -> bool:
        return self.index_path.exists() and self.texts_path.exists() and self.metadatas_path.exists()

    def reset(self) -> None:
        if self.faiss_dir.exists():
            shutil.rmtree(self.faiss_dir)

    def _ensure_exists(self) -> None:
        missing = [str(path) for path in (self.index_path, self.texts_path, self.metadatas_path) if not path.exists()]
        if missing:
            raise FileNotFoundError(f"missing FAISS files: {missing}")

    def _load_payload(self) -> tuple[list[str], list[dict[str, Any]]]:
        with self.texts_path.open("rb") as texts_file:
            texts = pickle.load(texts_file)
        with self.metadatas_path.open("rb") as metadata_file:
            metadatas = pickle.load(metadata_file)
        return texts, metadatas

    def _save_payload(self, texts: list[str], metadatas: list[dict[str, Any]]) -> None:
        with self.texts_path.open("wb") as texts_file:
            pickle.dump(texts, texts_file)
        with self.metadatas_path.open("wb") as metadata_file:
            pickle.dump(metadatas, metadata_file)
