from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HandoffReport, MonthlyReport, WeeklyReport


class ReportRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_weekly(self, project_id: UUID) -> list[WeeklyReport]:
        result = await self.db.execute(select(WeeklyReport).where(WeeklyReport.project_id == project_id))
        return list(result.scalars().all())

    async def list_monthly(self, project_id: UUID) -> list[MonthlyReport]:
        result = await self.db.execute(select(MonthlyReport).where(MonthlyReport.project_id == project_id))
        return list(result.scalars().all())

    async def latest_handoff(self, project_id: UUID) -> HandoffReport | None:
        result = await self.db.execute(
            select(HandoffReport)
            .where(HandoffReport.project_id == project_id)
            .order_by(HandoffReport.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
