from __future__ import annotations

import uuid
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db


app = FastAPI(title="OpsRadar AI Backend", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ChatMessageCreate(BaseModel):
    member_id: uuid.UUID | None = None
    content: str = Field(min_length=1)


def row_to_dict(row: Any) -> dict[str, Any]:
    return dict(row._mapping)


def ensure_project(db: Session, project_id: uuid.UUID) -> None:
    exists = db.scalar(
        text(
            """
            SELECT 1
            FROM projects
            WHERE id = :project_id
              AND deleted_at IS NULL
            """
        ),
        {"project_id": project_id},
    )

    if exists is None:
        raise HTTPException(status_code=404, detail="Project not found")


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "OpsRadar AI Backend", "docs": "/docs"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/projects")
def list_projects(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    result = db.execute(
        text(
            """
            SELECT id, team_id, name, description, status, created_at, updated_at
            FROM projects
            WHERE deleted_at IS NULL
            ORDER BY created_at DESC
            """
        )
    )

    return [row_to_dict(row) for row in result.all()]


@app.get("/projects/{project_id}/dashboard")
def project_dashboard(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ensure_project(db, project_id)

    project = row_to_dict(
        db.execute(
            text(
                """
                SELECT id, team_id, name, description, status, created_at, updated_at
                FROM projects
                WHERE id = :project_id
                """
            ),
            {"project_id": project_id},
        ).one()
    )

    todo_counts = {
        row.status: row.todo_count
        for row in db.execute(
            text(
                """
                SELECT status, COUNT(*) AS todo_count
                FROM todos
                WHERE project_id = :project_id
                GROUP BY status
                """
            ),
            {"project_id": project_id},
        ).all()
    }

    issue_counts = {
        row.status: row.issue_count
        for row in db.execute(
            text(
                """
                SELECT status, COUNT(*) AS issue_count
                FROM issues
                WHERE project_id = :project_id
                  AND approval_status IN ('approved', 'confirmed')
                GROUP BY status
                """
            ),
            {"project_id": project_id},
        ).all()
    }

    high_risk_issue_count = db.scalar(
        text(
            """
            SELECT COUNT(*)
            FROM issues
            WHERE project_id = :project_id
              AND severity IN ('high', 'critical')
              AND status IN ('open', 'in_progress', 'blocked')
              AND approval_status IN ('approved', 'confirmed')
            """
        ),
        {"project_id": project_id},
    )

    pending_ai_todos = db.scalar(
        text(
            """
            SELECT COUNT(*)
            FROM todos
            WHERE project_id = :project_id
              AND source_type = 'ai'
              AND approval_status = 'pending'
            """
        ),
        {"project_id": project_id},
    )

    document_count = db.scalar(
        text(
            """
            SELECT COUNT(*)
            FROM documents
            WHERE project_id = :project_id
              AND deleted_at IS NULL
            """
        ),
        {"project_id": project_id},
    )

    latest_summary = db.scalar(
        text(
            """
            SELECT summary
            FROM ai_summaries
            WHERE project_id = :project_id
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"project_id": project_id},
    )

    return {
        "project": project,
        "todo_counts": todo_counts,
        "issue_counts": issue_counts,
        "high_risk_issue_count": high_risk_issue_count or 0,
        "pending_ai_todos": pending_ai_todos or 0,
        "document_count": document_count or 0,
        "latest_summary": latest_summary,
    }


@app.get("/projects/{project_id}/todos")
def list_todos(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    ensure_project(db, project_id)

    result = db.execute(
        text(
            """
            SELECT
              t.id,
              t.project_id,
              t.assignee_member_id,
              u.name AS assignee_name,
              t.source_chunk_id,
              t.title,
              t.status,
              t.priority,
              t.source_type,
              t.approval_status,
              t.confidence_score,
              t.due_at,
              t.created_at,
              t.updated_at
            FROM todos t
            LEFT JOIN project_members pm ON pm.id = t.assignee_member_id
            LEFT JOIN users u ON u.id = pm.user_id
            WHERE t.project_id = :project_id
            ORDER BY t.created_at DESC
            """
        ),
        {"project_id": project_id},
    )

    return [row_to_dict(row) for row in result.all()]


@app.get("/projects/{project_id}/todos/ai-pending")
def list_pending_ai_todos(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    ensure_project(db, project_id)

    result = db.execute(
        text(
            """
            SELECT
              id,
              project_id,
              assignee_member_id,
              source_chunk_id,
              title,
              status,
              priority,
              source_type,
              approval_status,
              confidence_score,
              due_at,
              created_at,
              updated_at
            FROM todos
            WHERE project_id = :project_id
              AND source_type = 'ai'
              AND approval_status = 'pending'
            ORDER BY confidence_score DESC NULLS LAST, created_at DESC
            """
        ),
        {"project_id": project_id},
    )

    return [row_to_dict(row) for row in result.all()]


@app.get("/projects/{project_id}/issues")
def list_issues(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    ensure_project(db, project_id)

    result = db.execute(
        text(
            """
            SELECT
              i.id,
              i.project_id,
              i.assignee_member_id,
              u.name AS assignee_name,
              i.source_chunk_id,
              i.title,
              i.severity,
              i.status,
              i.source_type,
              i.approval_status,
              i.confidence_score,
              i.created_at,
              i.updated_at
            FROM issues i
            LEFT JOIN project_members pm ON pm.id = i.assignee_member_id
            LEFT JOIN users u ON u.id = pm.user_id
            WHERE i.project_id = :project_id
            ORDER BY
              CASE i.severity
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                ELSE 4
              END,
              i.created_at DESC
            """
        ),
        {"project_id": project_id},
    )

    return [row_to_dict(row) for row in result.all()]


@app.get("/projects/{project_id}/documents")
def list_documents(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    ensure_project(db, project_id)

    result = db.execute(
        text(
            """
            SELECT
              id,
              project_id,
              uploaded_by_member_id,
              file_name,
              file_type,
              storage_uri,
              content_hash,
              status,
              created_at,
              updated_at
            FROM documents
            WHERE project_id = :project_id
              AND deleted_at IS NULL
            ORDER BY created_at DESC
            """
        ),
        {"project_id": project_id},
    )

    return [row_to_dict(row) for row in result.all()]


@app.get("/projects/{project_id}/handoff/latest")
def latest_handoff(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict[str, Any] | None:
    ensure_project(db, project_id)

    row = db.execute(
        text(
            """
            SELECT
              id,
              project_id,
              from_member_id,
              to_member_id,
              handoff_type,
              content,
              created_at
            FROM handoff_reports
            WHERE project_id = :project_id
            ORDER BY created_at DESC
            LIMIT 1
            """
        ),
        {"project_id": project_id},
    ).first()

    return row_to_dict(row) if row else None


@app.post("/projects/{project_id}/chat/messages", status_code=201)
def create_chat_message(
    project_id: uuid.UUID,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ensure_project(db, project_id)

    if payload.member_id is not None:
        member_exists = db.scalar(
            text(
                """
                SELECT 1
                FROM project_members
                WHERE id = :member_id
                  AND project_id = :project_id
                """
            ),
            {"member_id": payload.member_id, "project_id": project_id},
        )

        if member_exists is None:
            raise HTTPException(
                status_code=400,
                detail="member_id is not part of this project",
            )

    row = db.execute(
        text(
            """
            INSERT INTO chat_messages (project_id, member_id, role, content)
            VALUES (:project_id, :member_id, 'user', :content)
            RETURNING id, project_id, member_id, role, content, created_at
            """
        ),
        {
            "project_id": project_id,
            "member_id": payload.member_id,
            "content": payload.content,
        },
    ).one()

    db.commit()

    return row_to_dict(row)


@app.get("/projects/{project_id}/chat/messages")
def list_chat_messages(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    ensure_project(db, project_id)

    result = db.execute(
        text(
            """
            SELECT id, project_id, member_id, role, content, created_at
            FROM chat_messages
            WHERE project_id = :project_id
            ORDER BY created_at ASC
            """
        ),
        {"project_id": project_id},
    )

    return [row_to_dict(row) for row in result.all()]