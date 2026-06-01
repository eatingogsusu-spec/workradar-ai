from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.issue import IssueRead
from app.services.issue_service import IssueService


router = APIRouter()


@router.get("", response_model=list[IssueRead])
async def list_issues(project_id: UUID, db: DbSession) -> list[IssueRead]:
    return await IssueService(db).list_confirmed(project_id)


@router.get("/candidates", response_model=list[IssueRead])
async def list_issue_candidates(project_id: UUID, db: DbSession) -> list[IssueRead]:
    return await IssueService(db).list_candidates(project_id)
