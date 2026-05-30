from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import DashboardService


router = APIRouter()


@router.get("", response_model=DashboardSummary)
async def get_dashboard(project_id: UUID, db: DbSession) -> DashboardSummary:
    return await DashboardService(db).summary(project_id)
