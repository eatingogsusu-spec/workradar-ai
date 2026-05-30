"""
UC-02 Todo 관리
담당: 김성호 (백엔드) + 이성우 (AI 추출)
"""
from fastapi import APIRouter
from typing import Optional

router = APIRouter()


@router.get("")
async def get_todos(
    status: Optional[str] = None,   # all | pending | in_progress | completed
    source: Optional[str] = None,   # ai | manual
):
    """Todo 목록 조회 (UC-02)"""
    # TODO: 김성호 — todos 테이블 조회 (status, source 필터)
    return {"todos": []}


@router.post("")
async def create_todo():
    """Todo 수동 등록 (UC-02)"""
    # TODO: 김성호 — todos 테이블 insert
    return {"status": "success", "todo_id": "todo_001"}


@router.patch("/{todo_id}")
async def update_todo(todo_id: str):
    """Todo 상태·내용 수정 — 승인/수정/반려 포함 (UC-02)"""
    # TODO: 김성호 — todos 테이블 update
    return {"status": "success", "todo_id": todo_id}
