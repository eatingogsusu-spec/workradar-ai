"""
UC-05 보고서 생성
담당: 김성호 (저장 API) + 이성우 (AI 초안)
"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate_report():
    """AI 보고서 초안 생성 (UC-05)"""
    # TODO: 이성우 — report_service.py 호출
    # TODO: 김성호 — reports 테이블 insert
    return {"report_id": "report_001", "period": "weekly", "content": ""}


@router.patch("/{report_id}")
async def update_report(report_id: str):
    """보고서 수정·저장 (UC-05)"""
    # TODO: 김성호 — reports 테이블 update
    return {"status": "success", "report_id": report_id}


@router.get("")
async def get_reports():
    """보고서 이력 조회 (UC-05)"""
    # TODO: 김성호 — reports 테이블 조회
    return {"reports": []}
