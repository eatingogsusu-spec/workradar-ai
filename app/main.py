from __future__ import annotations

import uuid
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChatMessage, Document, HandoffReport, Issue, Project, Todo


app = FastAPI(title="TeamAZAG Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


FRONTEND_DASHBOARD = {
    "summary": {
        "weekly": "이번 주는 대시보드 API 확정, 자료 업로드 파이프라인, TODO 승인 흐름이 핵심입니다.",
        "monthly": "월간 관점에서는 근거 문서, 날짜, 담당자 수기 입력을 함께 남기는 추적 규칙이 필요합니다.",
        "confidence": 82,
        "sources": ["weekly_meeting_2026_05_18", "dashboard_api_spec_v2", "todo_policy_notes"],
    },
    "project_board": [
        {"name": "기획", "status": "완료"},
        {"name": "프론트", "status": "거의 최종"},
        {"name": "백엔드", "status": "API 초안"},
        {"name": "AI 분석", "status": "테스트 필요"},
    ],
    "team_status": [
        {"member": "PM", "workload": "진행 5", "note": "AI 제안 검토 2"},
        {"member": "Frontend", "workload": "진행 3", "note": "화면 거의 최종"},
        {"member": "Backend", "workload": "진행 4", "note": "API 초안"},
        {"member": "AI", "workload": "진행 2", "note": "이슈 감지 테스트"},
    ],
    "resources": [
        {"name": "weekly_meeting_2026_05_18.docx", "type": "회의록", "status": "완료"},
        {"name": "team_chat_export_2026_05_17.csv", "type": "채팅", "status": "분석중"},
        {"name": "dashboard_api_spec_v2.pdf", "type": "문서", "status": "완료"},
        {"name": "handoff_notes.md", "type": "인수인계", "status": "완료"},
    ],
}

FRONTEND_UPLOADS = [
    {
        "name": "weekly_meeting_2026_05_18.docx",
        "type": "회의록",
        "status": "완료",
        "evidence_date": "2026.05.18",
        "result": "TODO 4건, 이슈 후보 1건",
    },
    {
        "name": "team_chat_export_2026_05_17.csv",
        "type": "채팅",
        "status": "분석중",
        "evidence_date": "2026.05.17",
        "result": "자연어 이슈 감지 테스트 중",
    },
]

FRONTEND_TODOS = [
    {
        "title": "대시보드 최종 화면 구조 반영",
        "status": "progress",
        "priority": "High",
        "assignee": "Frontend",
        "action": "화면 반영",
        "due_date": "2026.05.20",
        "evidence": "사용자 최종 프론트 메모",
        "evidence_date": "2026.05.18",
    },
    {
        "title": "마감 3일 전 이슈 자동 생성 규칙 정의",
        "status": "suggested",
        "priority": "High",
        "assignee": "PM",
        "action": "정책 승인",
        "due_date": "2026.05.21",
        "evidence": "이슈로그 요구사항",
        "evidence_date": "2026.05.18",
    },
    {
        "title": "자료 업로드 상태 표기 완료/분석중 분리",
        "status": "done",
        "priority": "Medium",
        "assignee": "Frontend",
        "action": "완료 확인",
        "due_date": "2026.05.18",
        "evidence": "AI 분석 화면 요구사항",
        "evidence_date": "2026.05.18",
    },
]

FRONTEND_ISSUES = [
    {
        "title": "마감 3일 전 자동 이슈 후보",
        "state": "자동 생성",
        "owner": "PM",
        "severity": "High",
        "detail": "대시보드 최종 화면 구조 반영 TODO가 2026.05.20 마감이라 이슈 로그에 노출됩니다.",
    },
    {
        "title": "자연어 이슈 감지 테스트 필요",
        "state": "검증 필요",
        "owner": "AI",
        "severity": "Medium",
        "detail": "채팅에서 '늦을 것 같다', '막혔다', '스펙이 불명확하다' 같은 표현을 이슈 후보로 잡을 수 있는지 테스트해야 합니다.",
    },
]

DEFAULT_REPORT = """[주간 보고서 초안]

1. 요약
- Project AZAG 프론트 구조는 거의 최종안 기준으로 정리되었습니다.
- 핵심 탭은 대시보드, AI 분석, TODO 관리, 이슈 로그, 보고서 생성, 지식 전달, AI Assistant입니다.
- TODO 누락 방지를 위해 근거 문서, 근거 날짜, 담당자 수기 확인 흐름이 필요합니다.

2. 확인 필요
- 자연어 기반 이슈 감지 정확도 테스트
- 근거 없는 TODO의 운영 정책
- 메일/채팅 연동 시점과 범위
"""


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ProjectOut(ORMModel):
    id: uuid.UUID
    name: str
    description: str | None
    status: str


class TodoOut(ORMModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: str
    priority: str
    source_type: str
    approval_status: str


class IssueOut(ORMModel):
    id: uuid.UUID
    title: str
    description: str | None
    severity: str
    status: str


class DocumentOut(ORMModel):
    id: uuid.UUID
    file_name: str
    file_type: str
    source_type: str
    status: str


class ChatMessageCreate(BaseModel):
    user_id: uuid.UUID | None = None
    content: str


class AssistantRequest(BaseModel):
    question: str


class UploadRequest(BaseModel):
    name: str
    type: str = "업무 문서"


@app.get("/api/dashboard")
def frontend_dashboard() -> dict[str, Any]:
    return FRONTEND_DASHBOARD


@app.get("/api/analysis/uploads")
def frontend_uploads() -> list[dict[str, str]]:
    return FRONTEND_UPLOADS


@app.post("/api/analysis/uploads")
def create_frontend_upload(payload: UploadRequest) -> dict[str, str]:
    return {
        "name": payload.name,
        "type": payload.type,
        "status": "분석중",
        "evidence_date": "업로드 직후",
        "result": "분석 대기",
    }


@app.get("/api/todos")
def frontend_todos(status: str | None = None) -> list[dict[str, str]]:
    if status is None or status == "all":
        return FRONTEND_TODOS
    return [todo for todo in FRONTEND_TODOS if todo["status"] == status]


@app.get("/api/issues")
def frontend_issues() -> list[dict[str, str]]:
    return FRONTEND_ISSUES


@app.get("/api/reports/default")
def frontend_default_report() -> dict[str, str]:
    return {"type": "weekly", "content": DEFAULT_REPORT}


@app.get("/api/knowledge")
def frontend_knowledge() -> dict[str, list[str]]:
    return {
        "onboarding": ["프로젝트 개요", "최근 의사결정 5건", "주요 자료실 문서", "담당자별 문의 경로"],
        "handoff": ["진행 중 TODO", "Blocked 이슈", "근거 문서가 약한 업무", "다음 주 보고서 항목"],
    }


@app.post("/api/assistant/chat")
def frontend_assistant(payload: AssistantRequest) -> dict[str, str]:
    question = payload.question
    if "마감" in question:
        answer = "마감 3일 이내 업무는 대시보드 최종 화면 구조 반영입니다. 담당자는 Frontend이고 마감일은 2026.05.20입니다."
    elif "근거" in question:
        answer = "근거가 약한 TODO는 담당자 수기 등록 흐름 검토입니다. 근거 문서와 날짜를 못 잡으면 확인 요청 상태로 남기는 방식을 권장합니다."
    elif "이슈" in question or "위험" in question:
        answer = "현재 가장 위험한 항목은 근거 자료가 없는 업무 누락입니다. 운영 정책 결정이 필요합니다."
    else:
        answer = "현재 기준으로 TODO, 이슈 로그, 자료실 상태를 바탕으로 답변합니다."
    return {"answer": answer}


def get_project_or_404(db: Session, project_id: uuid.UUID) -> Project:
    project = db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/projects", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)) -> list[Project]:
    return list(db.scalars(select(Project).order_by(Project.created_at.desc())).all())


@app.get("/projects/{project_id}/dashboard")
def project_dashboard(project_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any]:
    project = get_project_or_404(db, project_id)
    todo_counts = dict(
        db.execute(
            select(Todo.status, func.count(Todo.id))
            .where(Todo.project_id == project_id)
            .group_by(Todo.status)
        ).all()
    )
    issue_counts = dict(
        db.execute(
            select(Issue.status, func.count(Issue.id))
            .where(Issue.project_id == project_id)
            .group_by(Issue.status)
        ).all()
    )
    document_count = db.scalar(select(func.count(Document.id)).where(Document.project_id == project_id))
    pending_ai_todos = db.scalar(
        select(func.count(Todo.id)).where(
            Todo.project_id == project_id,
            Todo.source_type == "ai",
            Todo.approval_status == "pending",
        )
    )

    return {
        "project": ProjectOut.model_validate(project),
        "todo_counts": todo_counts,
        "issue_counts": issue_counts,
        "document_count": document_count or 0,
        "pending_ai_todos": pending_ai_todos or 0,
    }


@app.get("/projects/{project_id}/todos", response_model=list[TodoOut])
def list_todos(project_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Todo]:
    get_project_or_404(db, project_id)
    return list(db.scalars(select(Todo).where(Todo.project_id == project_id).order_by(Todo.created_at.desc())).all())


@app.get("/projects/{project_id}/todos/ai-pending", response_model=list[TodoOut])
def list_pending_ai_todos(project_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Todo]:
    get_project_or_404(db, project_id)
    return list(
        db.scalars(
            select(Todo)
            .where(
                Todo.project_id == project_id,
                Todo.source_type == "ai",
                Todo.approval_status == "pending",
            )
            .order_by(Todo.created_at.desc())
        ).all()
    )


@app.get("/projects/{project_id}/issues", response_model=list[IssueOut])
def list_issues(project_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Issue]:
    get_project_or_404(db, project_id)
    return list(db.scalars(select(Issue).where(Issue.project_id == project_id).order_by(Issue.created_at.desc())).all())


@app.get("/projects/{project_id}/documents", response_model=list[DocumentOut])
def list_documents(project_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Document]:
    get_project_or_404(db, project_id)
    return list(
        db.scalars(select(Document).where(Document.project_id == project_id).order_by(Document.uploaded_at.desc())).all()
    )


@app.post("/projects/{project_id}/chat/messages")
def create_chat_message(
    project_id: uuid.UUID,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    get_project_or_404(db, project_id)
    message = ChatMessage(project_id=project_id, user_id=payload.user_id, role="user", content=payload.content)
    db.add(message)
    db.commit()
    db.refresh(message)
    return {"id": message.id, "role": message.role, "content": message.content, "created_at": message.created_at}


@app.get("/projects/{project_id}/chat/messages")
def list_chat_messages(project_id: uuid.UUID, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    get_project_or_404(db, project_id)
    messages = db.scalars(
        select(ChatMessage).where(ChatMessage.project_id == project_id).order_by(ChatMessage.created_at.asc())
    ).all()
    return [
        {
            "id": message.id,
            "user_id": message.user_id,
            "role": message.role,
            "content": message.content,
            "sources_json": message.sources_json,
            "created_at": message.created_at,
        }
        for message in messages
    ]


@app.get("/projects/{project_id}/handoff/latest")
def latest_handoff(project_id: uuid.UUID, db: Session = Depends(get_db)) -> dict[str, Any] | None:
    get_project_or_404(db, project_id)
    report = db.scalar(
        select(HandoffReport).where(HandoffReport.project_id == project_id).order_by(HandoffReport.created_at.desc())
    )
    if report is None:
        return None
    return {
        "id": report.id,
        "title": report.title,
        "content": report.content,
        "handoff_score": report.handoff_score,
        "missing_items_json": report.missing_items_json,
        "created_at": report.created_at,
    }
