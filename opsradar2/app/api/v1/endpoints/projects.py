"""Project-scoped API routes.

Legacy routes such as /todos and /issues stay available for the current
frontend. These routes make the intended project boundary explicit.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.endpoints.calendar import create_calendar_events
from app.core.database import get_db
from app.repositories.calendar_repository import CalendarRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.todo_repository import TodoRepository
from app.schemas.issue import IssueCreate
from app.services.calendar_service import CalendarService
from app.services.dashboard_service import DashboardService
from app.services.issue_service import IssueService
from app.services.report_service import ReportService
from app.services.todo_service import TodoService

router = APIRouter()


async def ensure_project(db: AsyncSession, project_id: str) -> None:
    result = await db.execute(
        text("SELECT 1 FROM projects WHERE id = CAST(:project_id AS uuid) AND deleted_at IS NULL"),
        {"project_id": project_id},
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(404, "project not found")


def ensure_project_access(actor: dict, project_id: str) -> None:
    if actor.get("project_id") != project_id:
        raise HTTPException(403, "project access denied")


@router.get("/{project_id}/dashboard/summary")
async def project_dashboard_summary(project_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    return await DashboardService(db).summary(project_id=project_id)


@router.get("/{project_id}/todos")
async def project_todos(
    project_id: str,
    status: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    await ensure_project(db, project_id)
    normalized_status = None if status in (None, "all") else status
    todos = await TodoService(TodoRepository(db)).list_todos(
        status=normalized_status,
        source=source,
        project_id=project_id,
    )
    return {"todos": todos}


@router.post("/{project_id}/todos")
async def create_project_todo(project_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    if not body.get("title"):
        raise HTTPException(400, "title is required")
    todo_id = await TodoService(TodoRepository(db)).create_todo({**body, "project_id": project_id})
    return {"status": "success", "todo_id": todo_id}


@router.get("/{project_id}/issues")
async def project_issues(
    project_id: str,
    status: Optional[str] = None,
    risk_level: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    await ensure_project(db, project_id)
    normalized_status = None if status in (None, "all") else status
    issues = await IssueService(IssueRepository(db)).list_issues(
        status=normalized_status,
        risk_level=risk_level,
        project_id=project_id,
    )
    return {"issues": issues}


@router.post("/{project_id}/issues")
async def create_project_issue(project_id: str, body: IssueCreate, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    issue = await IssueService(IssueRepository(db)).create_issue({**body.model_dump(), "project_id": project_id})
    return issue


@router.get("/{project_id}/calendar")
async def project_calendar(
    project_id: str,
    actor: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_project_access(actor, project_id)
    await ensure_project(db, project_id)
    events = await CalendarService(CalendarRepository(db)).list_events(project_id=project_id)
    return {"events": events}


@router.post("/{project_id}/calendar/")
async def create_project_calendar_event(
    project_id: str,
    body: dict,
    actor: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ensure_project_access(actor, project_id)
    await ensure_project(db, project_id)
    events = await create_calendar_events(body, project_id=project_id, db=db)
    return {"event": events[0], "events": events}


@router.get("/{project_id}/documents")
async def project_documents(project_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    result = await db.execute(
        text(
            """
            SELECT id::text AS id, file_name, file_type, analysis_status, progress, created_at
            FROM documents
            WHERE project_id = CAST(:project_id AS uuid)
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            """
        ),
        {"project_id": project_id},
    )
    return {"documents": [dict(row) for row in result.mappings().all()]}


@router.get("/{project_id}/handoff/latest")
async def latest_project_handoff(project_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    result = await db.execute(
        text(
            """
            SELECT id::text AS id, project_id::text AS project_id, content, created_at
            FROM handoff_reports
            WHERE project_id = CAST(:project_id AS uuid)
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"project_id": project_id},
    )
    row = result.mappings().first()
    return {"handoff": dict(row) if row else None}


@router.post("/{project_id}/reports/generate")
async def generate_project_report(project_id: str, body: dict | None = None, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    period = (body or {}).get("period", "weekly")
    return await ReportService(ReportRepository(db)).generate_report(period, project_id=project_id)


@router.get("/{project_id}/reports")
async def project_reports(project_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_project(db, project_id)
    reports = await ReportService(ReportRepository(db)).list_reports(project_id=project_id)
    return {"reports": reports}
