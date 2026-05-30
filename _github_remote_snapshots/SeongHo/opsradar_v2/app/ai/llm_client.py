from app.core.config import settings


class LLMClient:
    async def complete(self, prompt: str) -> str:
        if settings.AI_PROVIDER == "mock":
            return "{}"
        raise NotImplementedError(f"{settings.AI_PROVIDER} client is not implemented yet.")
