from uuid import UUID


class KnowledgeService:
    async def onboarding_brief(self, project_id: UUID) -> dict:
        return {"project_id": project_id, "summary": "Knowledge brief generation is not implemented yet."}
