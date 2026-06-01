from app.ai.llm_client import LLMClient
from app.ai.prompt_builder import PromptBuilder


class AnalysisRunner:
    def __init__(self) -> None:
        self.prompt_builder = PromptBuilder()
        self.llm_client = LLMClient()

    async def extract(self, content: str) -> str:
        prompt = self.prompt_builder.build_extraction_prompt(content)
        return await self.llm_client.complete(prompt)
