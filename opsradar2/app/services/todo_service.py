"""Todo business logic."""

from typing import Optional

from app.repositories.todo_repository import TodoRepository


class TodoService:
    def __init__(self, repo: TodoRepository):
        self.repo = repo

    async def list_todos(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 15,
        offset: int = 0,
    ) -> list[dict]:
        return await self.repo.get_all(status=status, source=source, project_id=project_id, limit=limit, offset=offset)

    async def count_todos(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> int:
        return await self.repo.count(status=status, source=source, project_id=project_id)

    async def create_todo(self, data: dict) -> str:
        return await self.repo.create(data)

    async def update_todo_status(self, todo_id: str, status: str) -> bool:
        return await self.repo.update_status(todo_id, status)

    async def update_todo(self, todo_id: str, data: dict) -> bool:
        return await self.repo.update(todo_id, data)

    async def delete_todo(self, todo_id: str) -> bool:
        return await self.repo.delete(todo_id)
