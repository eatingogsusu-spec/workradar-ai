from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Issue
from app.repositories.issue_repository import IssueRepository


class IssueService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = IssueRepository(db)

    async def list_confirmed(self, project_id: UUID) -> list[Issue]:
        return await self.repository.list_by_project(project_id, is_candidate=False)

    async def list_candidates(self, project_id: UUID) -> list[Issue]:
        return await self.repository.list_by_project(project_id, is_candidate=True)
