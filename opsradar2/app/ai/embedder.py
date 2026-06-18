"""Azure OpenAI embedding client."""

from __future__ import annotations

from app.ai.llm_client import AzureOpenAIConfigError, get_azure_openai_client
from app.core.config import settings


def _require_embedding_deployment() -> None:
    if not settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT:
        raise AzureOpenAIConfigError(
            "Missing Azure OpenAI setting: AZURE_OPENAI_EMBEDDING_DEPLOYMENT"
        )


async def embed_text(text: str) -> list[float]:
    vectors = await embed_texts([text])
    return vectors[0]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Create embeddings for one or more text chunks."""
    if settings.AI_PROVIDER.lower() != "azure":
        raise AzureOpenAIConfigError("AI_PROVIDER=azure is required for embeddings")

    if not texts:
        return []

    _require_embedding_deployment()
    batch_size = max(1, settings.EMBEDDING_BATCH_SIZE)
    vectors: list[list[float]] = []
    client = get_azure_openai_client()
    for start in range(0, len(texts), batch_size):
        response = await client.embeddings.create(
            model=settings.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
            input=texts[start : start + batch_size],
            dimensions=settings.EMBEDDING_DIMENSION,
        )
        batch = [item.embedding for item in sorted(response.data, key=lambda item: item.index)]
        if len(batch) != len(texts[start : start + batch_size]):
            raise RuntimeError("Azure OpenAI returned an incomplete embedding batch")
        vectors.extend(batch)
    return vectors
