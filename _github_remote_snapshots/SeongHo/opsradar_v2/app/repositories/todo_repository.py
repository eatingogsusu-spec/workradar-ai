from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Todo


class TodoRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_by_project(self, project_id: UUID, approval_status: str | None = None) -> list[Todo]:
        stmt = select(Todo).where(Todo.project_id == project_id)
        if approval_status:
            stmt = stmt.where(Todo.approval_status == approval_status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
