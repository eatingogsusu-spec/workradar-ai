"""Report API."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.report_repository import ReportRepository
from app.services.report_service import ReportService

router = APIRouter()


@router.post("/generate")
async def generate_report(body: dict | None = None, db: AsyncSession = Depends(get_db)):
    period = (body or {}).get("period", "weekly")
    project_id = (body or {}).get("project_id")
    try:
        return await ReportService(ReportRepository(db)).generate_report(period, project_id=project_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/review-check")
async def get_report_review_check(project_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    return await ReportService(ReportRepository(db)).review_check(project_id=project_id)


@router.patch("/{report_id}")
async def update_report(report_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    content = body.get("content")
    if content is None:
        raise HTTPException(400, "content is required")

    updated = await ReportService(ReportRepository(db)).update_report(report_id, content)
    if not updated:
        raise HTTPException(404, "report not found")
    return {"status": "success", "report_id": report_id}


@router.get("")
async def get_reports(project_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    reports = await ReportService(ReportRepository(db)).list_reports(project_id=project_id)
    return {"reports": reports}
