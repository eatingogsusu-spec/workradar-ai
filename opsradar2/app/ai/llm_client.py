"""Azure OpenAI chat client.

Application code should call this module instead of reading API keys directly.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

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


async def chat_completion(
    user_message: str,
    *,
    system_prompt: str | None = None,
    temperature: float = 0.2,
) -> str:
    """Return a chat answer from the configured Azure OpenAI deployment."""
    if settings.AI_PROVIDER.lower() != "azure":
        return "Set AI_PROVIDER=azure to enable Azure OpenAI responses."

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_message})

    response = await get_azure_openai_client().chat.completions.create(
        model=settings.AZURE_OPENAI_CHAT_DEPLOYMENT,
        messages=messages,
        temperature=temperature,
    )
    return response.choices[0].message.content or ""
