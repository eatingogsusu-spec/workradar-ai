from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Todo
from app.repositories.todo_repository import TodoRepository


class TodoService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = TodoRepository(db)

    async def list_official(self, project_id: UUID) -> list[Todo]:
        return await self.repository.list_by_project(project_id, approval_status="approved")

    async def list_candidates(self, project_id: UUID) -> list[Todo]:
        return await self.repository.list_by_project(project_id, approval_status="pending")
