"""Embedding client (Azure OpenAI or local Ollama)."""

from __future__ import annotations

import httpx

from app.ai.llm_client import AzureOpenAIConfigError, get_azure_openai_client
from app.core.config import settings


def _require_embedding_deployment() -> None:
    if not settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT:
        raise AzureOpenAIConfigError(
            "Missing Azure OpenAI setting: AZURE_OPENAI_EMBEDDING_DEPLOYMENT"
        )


def _ollama_root() -> str:
    """Return the Ollama server root, stripping a trailing OpenAI-compat /v1."""
    base = settings.OLLAMA_BASE_URL.rstrip("/")
    if base.endswith("/v1"):
        base = base[: -len("/v1")]
    return base or "http://localhost:11434"


async def _ollama_embed(texts: list[str]) -> list[list[float]]:
    """Call the native Ollama /api/embeddings endpoint (one prompt per request)."""
    url = f"{_ollama_root()}/api/embeddings"
    model = settings.OLLAMA_EMBED_MODEL
    vectors: list[list[float]] = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for text in texts:
            response = await client.post(
                url,
                json={"model": model, "prompt": text},
            )
            response.raise_for_status()
            embedding = response.json().get("embedding")
            if not embedding:
                raise RuntimeError("Ollama returned an empty embedding")
            vectors.append(embedding)
    return vectors


async def embed_text(text: str) -> list[float]:
    vectors = await embed_texts([text])
    return vectors[0]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Create embeddings for one or more text chunks."""
    provider = settings.AI_PROVIDER.lower()
    if provider not in ("azure", "ollama"):
        raise AzureOpenAIConfigError(
            "AI_PROVIDER=azure or ollama is required for embeddings"
        )

    if not texts:
        return []

    if provider == "ollama":
        return await _ollama_embed(texts)

    # Azure OpenAI (text-embedding-3-large, native 3072) shortened via dimensions.
    _require_embedding_deployment()
    batch_size = max(1, settings.EMBEDDING_BATCH_SIZE)
    vectors: list[list[float]] = []
    client = get_azure_openai_client()
    for start in range(0, len(texts), batch_size):
        batch_input = texts[start : start + batch_size]
        response = await client.embeddings.create(
            model=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            input=batch_input,
            dimensions=settings.EMBEDDING_DIMENSION,
        )
        batch = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
        if len(batch) != len(batch_input):
            raise RuntimeError("Azure OpenAI returned an incomplete embedding batch")
        vectors.extend(batch)
    return vectors
