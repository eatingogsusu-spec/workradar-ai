"""Chat client (Azure OpenAI or local Ollama).

Application code should call this module instead of reading API keys directly.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx

from app.core.config import settings


class AzureOpenAIConfigError(RuntimeError):
    """Raised when Azure OpenAI is selected but required env vars are missing."""


def _require_azure_settings() -> None:
    missing = [
        name
        for name, value in {
            "AZURE_OPENAI_API_KEY": settings.AZURE_OPENAI_API_KEY,
            "AZURE_OPENAI_ENDPOINT": settings.AZURE_OPENAI_ENDPOINT,
            "AZURE_OPENAI_API_VERSION": settings.AZURE_OPENAI_API_VERSION,
            "AZURE_OPENAI_CHAT_DEPLOYMENT": settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
        }.items()
        if not value
    ]
    if missing:
        raise AzureOpenAIConfigError(
            "Missing Azure OpenAI setting(s): " + ", ".join(missing)
        )


@lru_cache(maxsize=1)
def get_azure_openai_client() -> Any:
    _require_azure_settings()
    try:
        from openai import AsyncAzureOpenAI
    except ModuleNotFoundError as exc:
        raise AzureOpenAIConfigError(
            "Missing Python package: openai. Run `pip install -r requirements.txt`."
        ) from exc

    return AsyncAzureOpenAI(
        api_key=settings.AZURE_OPENAI_API_KEY,
        azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
        api_version=settings.AZURE_OPENAI_API_VERSION,
    )


def _ollama_chat_url() -> str:
    """Return the Ollama OpenAI-compatible chat endpoint, tolerating a missing /v1."""
    base = settings.OLLAMA_BASE_URL.rstrip("/") or "http://localhost:11434/v1"
    if not base.endswith("/v1"):
        base = f"{base}/v1"
    return f"{base}/chat/completions"


async def _ollama_chat(messages: list[dict[str, str]], temperature: float) -> str:
    """Call Ollama's OpenAI-compatible chat endpoint.

    Transport and protocol failures surface as RuntimeError because callers only
    guard against RuntimeError/ValueError, not httpx exceptions.
    """
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                _ollama_chat_url(),
                headers={"Authorization": "Bearer ollama"},
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": messages,
                    "temperature": temperature,
                    "stream": False,
                },
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Ollama chat request failed: {exc}") from exc

    choices = payload.get("choices") or []
    if not choices:
        raise RuntimeError("Ollama returned no chat choices")
    return choices[0].get("message", {}).get("content") or ""


async def chat_completion(
    user_message: str,
    *,
    system_prompt: str | None = None,
    temperature: float = 0.2,
) -> str:
    """Return a chat answer from the configured provider (Azure OpenAI or Ollama)."""
    provider = settings.AI_PROVIDER.lower()
    if provider not in ("azure", "ollama"):
        return "Set AI_PROVIDER=azure or ollama to enable LLM responses."

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_message})

    if provider == "ollama":
        return await _ollama_chat(messages, temperature)

    response = await get_azure_openai_client().chat.completions.create(
        model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content or ""
