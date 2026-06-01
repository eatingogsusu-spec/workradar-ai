from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.repositories.document_repository import DocumentRepository


class DocumentService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = DocumentRepository(db)

    async def list_documents(self, project_id: UUID) -> list[Document]:
        return await self.repository.list_by_project(project_id)
