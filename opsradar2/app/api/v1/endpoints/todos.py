"""Todo API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.todo_repository import TodoRepository
from app.services.todo_service import TodoService

router = APIRouter()


@router.get("")
async def get_todos(
    status: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    service = TodoService(TodoRepository(db))
    normalized_status = None if status in (None, "all") else status
    return {"todos": await service.list_todos(status=normalized_status, source=source)}


@router.post("")
async def create_todo(body: dict, db: AsyncSession = Depends(get_db)):
    if not body.get("title"):
        raise HTTPException(400, "title is required")
    service = TodoService(TodoRepository(db))
    todo_id = await service.create_todo(body)
    return {"status": "success", "todo_id": todo_id}


@router.patch("/{todo_id}")
async def update_todo(todo_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    service = TodoService(TodoRepository(db))
    updated = await service.update_todo(todo_id, body)
    if not updated:
        raise HTTPException(404, "todo not found")
    return {"status": "success", "todo_id": todo_id}
