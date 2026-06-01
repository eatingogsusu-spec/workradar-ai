from __future__ import annotations

import uuid
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChatMessage, Document, HandoffReport, Issue, Project, Todo


app = FastAPI(title="TeamAZAG Backend", version="0.1.0")


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

