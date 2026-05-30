from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.report import HandoffReportRead, MonthlyReportRead, WeeklyReportRead
from app.services.report_service import ReportService


router = APIRouter()


@router.get("/weekly", response_model=list[WeeklyReportRead])
async def list_weekly_reports(project_id: UUID, db: DbSession) -> list[WeeklyReportRead]:
    return await ReportService(db).list_weekly(project_id)


@router.get("/monthly", response_model=list[MonthlyReportRead])
async def list_monthly_reports(project_id: UUID, db: DbSession) -> list[MonthlyReportRead]:
    return await ReportService(db).list_monthly(project_id)


@router.get("/handoff/latest", response_model=HandoffReportRead | None)
async def latest_handoff_report(project_id: UUID, db: DbSession) -> HandoffReportRead | None:
    return await ReportService(db).latest_handoff(project_id)
