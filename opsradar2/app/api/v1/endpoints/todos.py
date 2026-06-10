"""Todo API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.todo_repository import TodoRepository
from app.schemas.todo import TodoCreate, TodoUpdate
from app.services.todo_service import TodoService

router = APIRouter()


@router.get("")
async def get_todos(
    status: Optional[str] = None,
    source: Optional[str] = None,
    project_id: Optional[str] = None,
    page: int = 1,
    limit: int = 15,
    db: AsyncSession = Depends(get_db),
):
    service = TodoService(TodoRepository(db))
    normalized_status = None if status in (None, "all") else status
    offset = (page - 1) * limit
    todos = await service.list_todos(status=normalized_status, source=source, project_id=project_id, limit=limit, offset=offset)
    total = await service.count_todos(status=normalized_status, source=source, project_id=project_id)
    return {
        "todos": todos,
        "total": total,
        "page": page,
        "page_size": limit,
        "has_next": offset + len(todos) < total,
    }


@router.post("")
async def create_todo(body: TodoCreate, db: AsyncSession = Depends(get_db)):
    service = TodoService(TodoRepository(db))
    todo_id = await service.create_todo(body.model_dump(exclude_none=True))
    return {"status": "success", "todo_id": todo_id}


@router.patch("/{todo_id}")
async def update_todo(todo_id: str, body: TodoUpdate, db: AsyncSession = Depends(get_db)):
    service = TodoService(TodoRepository(db))
    updated = await service.update_todo(todo_id, body.model_dump(exclude_unset=True, exclude_none=True))
    if not updated:
        raise HTTPException(404, "todo not found")
    return {"status": "success", "todo_id": todo_id}
@router.delete("/{todo_id}")
async def delete_todo(todo_id: str, db: AsyncSession = Depends(get_db)):
    service = TodoService(TodoRepository(db))
    deleted = await service.delete_todo(todo_id)
    if not deleted:
        raise HTTPException(404, "todo not found")
    return {"status": "success", "todo_id": todo_id}
