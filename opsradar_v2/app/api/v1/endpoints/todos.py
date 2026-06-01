from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.todo import TodoRead
from app.services.todo_service import TodoService


router = APIRouter()


@router.get("", response_model=list[TodoRead])
async def list_todos(project_id: UUID, db: DbSession) -> list[TodoRead]:
    return await TodoService(db).list_official(project_id)


@router.get("/candidates", response_model=list[TodoRead])
async def list_todo_candidates(project_id: UUID, db: DbSession) -> list[TodoRead]:
    return await TodoService(db).list_candidates(project_id)
