from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Issue


class IssueRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_project(self, project_id: UUID, is_candidate: bool | None = None) -> list[Issue]:
        stmt = select(Issue).where(Issue.project_id == project_id)
        if is_candidate is not None:
            stmt = stmt.where(Issue.is_candidate == is_candidate)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
