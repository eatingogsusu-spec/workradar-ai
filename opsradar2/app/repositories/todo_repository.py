"""
Todo DB 쿼리
담당: 박주원
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.todo import Todo


class TodoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None
    ) -> list[Todo]:
        query = select(Todo)
        if status:
            query = query.where(Todo.status == status)
        if source:
            query = query.where(Todo.source == source)
        result = await self.db.execute(
            query.order_by(Todo.created_at.desc())
        )
        return result.scalars().all()

    async def get_by_id(self, todo_id: str) -> Optional[Todo]:
        result = await self.db.execute(
            select(Todo).where(Todo.id == todo_id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> Todo:
        todo = Todo(**data)
        self.db.add(todo)
        await self.db.commit()
        await self.db.refresh(todo)
        return todo

    async def update(self, todo: Todo, data: dict) -> Todo:
        for key, value in data.items():
            setattr(todo, key, value)
        await self.db.commit()
        await self.db.refresh(todo)
        return todo

    async def delete(self, todo: Todo) -> None:
        await self.db.delete(todo)
        await self.db.commit()