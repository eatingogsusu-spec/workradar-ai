"""
UC-03 이슈 로그
담당: 김성호 (백엔드) + 이성우 (리스크 탐지)
"""
from fastapi import APIRouter
from typing import Optional

router = APIRouter()


@router.get("")
async def get_issues(
    status: Optional[str] = None,      # open | in_progress | resolved
    risk_level: Optional[str] = None,  # high | medium | low
):
    """이슈 목록 조회 (UC-03)"""
    # TODO: 김성호 — issues 테이블 조회
    return {"issues": []}


@router.patch("/{issue_id}")
async def update_issue(issue_id: str):
    """이슈 상태·담당자 수정 (UC-03)"""
    # TODO: 김성호 — issues 테이블 update
    return {"status": "success", "issue_id": issue_id}


@router.post("/{issue_id}/todos")
async def create_todo_from_issue(issue_id: str):
    """이슈 → 대응 Todo 생성 (UC-03 → UC-02 연동)"""
    # TODO: 김성호 — todos 테이블 insert (linked_issue_id 포함)
    return {"status": "success", "todo_id": "todo_001", "linked_issue_id": issue_id}
