class PromptBuilder:
    def build_extraction_prompt(self, content: str) -> str:
        return f"Extract todos, issues, decisions, and summary from this project content:\n\n{content}"
