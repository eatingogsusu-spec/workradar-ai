"""Todo business logic."""

from typing import Optional

from app.repositories.todo_repository import TodoRepository


class TodoService:
    def __init__(self, repo: TodoRepository):
        self.repo = repo

    async def list_todos(self, status: Optional[str] = None, source: Optional[str] = None) -> list[dict]:
        return await self.repo.get_all(status=status, source=source)

    async def create_todo(self, data: dict) -> str:
        return await self.repo.create(data)

    async def update_todo_status(self, todo_id: str, status: str) -> bool:
        return await self.repo.update_status(todo_id, status)

    async def update_todo(self, todo_id: str, data: dict) -> bool:
        return await self.repo.update(todo_id, data)
