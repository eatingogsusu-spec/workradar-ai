"""Issue API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.issue_repository import IssueRepository
from app.repositories.todo_repository import TodoRepository
from app.schemas.issue import IssueCreate, IssueUpdate
from app.schemas.todo import TodoCreate
from app.services.issue_service import IssueService

router = APIRouter()


@router.post("")
async def create_issue(body: IssueCreate, db: AsyncSession = Depends(get_db)):
    service = IssueService(IssueRepository(db))
    return await service.create_issue(body.model_dump(exclude_none=True))


@router.get("")
async def get_issues(
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    project_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    service = IssueService(IssueRepository(db))
    normalized_status = None if status in (None, "all") else status
    return {
        "issues": await service.list_issues(
            status=normalized_status,
            risk_level=risk_level,
            project_id=project_id,
        )
    }


@router.patch("/{issue_id}")
async def update_issue(issue_id: str, body: IssueUpdate, db: AsyncSession = Depends(get_db)):
    service = IssueService(IssueRepository(db))
    updated = await service.update_issue(issue_id, body.model_dump(exclude_unset=True, exclude_none=True))
    if not updated:
        raise HTTPException(404, "issue not found")
    return {"status": "success", "issue_id": issue_id}


@router.patch("/{issue_id}/resolve")
async def resolve_issue(issue_id: str, db: AsyncSession = Depends(get_db)):
    service = IssueService(IssueRepository(db))
    updated = await service.resolve_issue(issue_id)
    if not updated:
        raise HTTPException(404, "issue not found")
    return {"status": "success", "issue_id": issue_id}


@router.delete("/{issue_id}")
async def delete_issue(issue_id: str, db: AsyncSession = Depends(get_db)):
    service = IssueService(IssueRepository(db))
    deleted = await service.delete_issue(issue_id)
    if not deleted:
        raise HTTPException(404, "issue not found")
    return {"status": "success", "issue_id": issue_id}


@router.post("/{issue_id}/todos")
async def create_todo_from_issue(issue_id: str, body: TodoCreate, db: AsyncSession = Depends(get_db)):
    service = IssueService(IssueRepository(db), TodoRepository(db))
    todo_id = await service.create_todo_from_issue(issue_id, body.model_dump(exclude_none=True))
    if not todo_id:
        raise HTTPException(404, "issue not found")
    return {"status": "success", "todo_id": todo_id, "linked_issue_id": issue_id}
