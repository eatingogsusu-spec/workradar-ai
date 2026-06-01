from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HandoffReport, MonthlyReport, WeeklyReport
from app.repositories.report_repository import ReportRepository


class ReportService:
    def __init__(self, db: AsyncSession) -> None:
        self.repository = ReportRepository(db)

    async def list_weekly(self, project_id: UUID) -> list[WeeklyReport]:
        return await self.repository.list_weekly(project_id)

    async def list_monthly(self, project_id: UUID) -> list[MonthlyReport]:
        return await self.repository.list_monthly(project_id)

    async def latest_handoff(self, project_id: UUID) -> HandoffReport | None:
        return await self.repository.latest_handoff(project_id)
