from uuid import UUID

from fastapi import APIRouter

from app.services.knowledge_service import KnowledgeService


router = APIRouter()


@router.get("/onboarding")
async def onboarding_brief(project_id: UUID) -> dict:
    return await KnowledgeService().onboarding_brief(project_id)
