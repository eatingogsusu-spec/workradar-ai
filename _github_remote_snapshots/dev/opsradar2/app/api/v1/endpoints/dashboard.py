"""
UC-04 Dashboard
담당: 김성호 (집계 API)
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/summary")
async def get_dashboard_summary():
    """대시보드 전체 현황 집계 (UC-04)"""
    # TODO: 김성호 — todos/issues/documents 집계 쿼리
    return {
        "high_risk_count": 0,
        "todo_total": 0,
        "todo_completed": 0,
        "todo_pending": 0,
        "blocked_count": 0,
        "ai_summary": "",
        "recent_activities": [],
    }
