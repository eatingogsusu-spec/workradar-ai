from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import DocumentChunk


class ChunkRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_document(self, document_id: UUID) -> list[DocumentChunk]:
        result = await self.db.execute(select(DocumentChunk).where(DocumentChunk.document_id == document_id))
        return list(result.scalars().all())
