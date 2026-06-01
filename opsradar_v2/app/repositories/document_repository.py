from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document


class DocumentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_project(self, project_id: UUID) -> list[Document]:
        result = await self.db.execute(select(Document).where(Document.project_id == project_id))
        return list(result.scalars().all())
