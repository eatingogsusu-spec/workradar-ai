"""Role-aware review workflow for AI-extracted Todo and Risk candidates."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token

router = APIRouter()


class ReviewItemUpdate(BaseModel):
    title: str = Field(min_length=1)
    description: str | None = None
    assignee: str | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    due_at: str | None = None


class ReviewBatch(BaseModel):
    items: dict[str, ReviewItemUpdate]


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1)


def _due_at(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = date.fromisoformat(value[:10])
    return datetime.combine(parsed, time.min)


async def _actor(db: AsyncSession, authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "login required")
    payload = decode_access_token(authorization.split(" ", 1)[1])
    if not payload or not payload.get("sub"):
        raise HTTPException(401, "invalid token")
    result = await db.execute(
        text(
            """
            SELECT
              u.id::text AS user_id, u.username, u.name, u.role,
              pm.id::text AS member_id, pm.project_id::text AS project_id
            FROM users u
            JOIN project_members pm ON pm.user_id = u.id AND pm.status = 'active'
            WHERE u.id = CAST(:user_id AS uuid)
            ORDER BY pm.joined_at
            LIMIT 1
            """
        ),
        {"user_id": payload["sub"]},
    )
    actor = result.mappings().one_or_none()
    if not actor:
        raise HTTPException(403, "active project member required")
    return dict(actor)


def _is_lead(actor: dict) -> bool:
    return actor["username"] == "hj" or str(actor["role"]).lower() in {"admin", "pm", "leader"}


@router.get("/review")
async def review_items(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    actor = await _actor(db, authorization)
    todo_result = await db.execute(
        text(
            """
            SELECT
              t.id::text AS id, t.title, t.description, t.status, t.priority,
              t.approval_status, t.due_at, t.created_at, t.updated_at,
              assignee_u.name AS assignee, reviewer_u.name AS sent_by,
              d.id::text AS document_id, d.file_name AS source_file_name
            FROM todos t
            LEFT JOIN project_members assignee_pm ON assignee_pm.id = t.assignee_member_id
            LEFT JOIN users assignee_u ON assignee_u.id = assignee_pm.user_id
            LEFT JOIN project_members reviewer_pm ON reviewer_pm.id = t.reviewed_by_member_id
            LEFT JOIN users reviewer_u ON reviewer_u.id = reviewer_pm.user_id
            LEFT JOIN documents d ON d.id = t.source_document_id AND d.deleted_at IS NULL
            WHERE t.project_id = CAST(:project_id AS uuid)
              AND t.source_type = 'ai'
              AND t.approval_status = 'pending'
              AND (
                (:is_lead AND t.reviewed_by_member_id IS NOT NULL)
                OR (
                  NOT :is_lead
                  AND (
                    (d.uploaded_by_member_id = CAST(:member_id AS uuid) AND t.reviewed_by_member_id IS NULL)
                    OR t.reviewed_by_member_id = CAST(:member_id AS uuid)
                    OR t.assignee_member_id = CAST(:member_id AS uuid)
                  )
                )
              )
            ORDER BY COALESCE(t.updated_at, t.created_at) DESC
            """
        ),
        {"project_id": actor["project_id"], "member_id": actor["member_id"], "is_lead": _is_lead(actor)},
    )
    risk_result = await db.execute(
        text(
            """
            SELECT
              i.id::text AS id, i.title, i.description, i.status, i.severity,
              i.approval_status, i.due_at, i.risk_reason, i.created_at, i.updated_at,
              assignee_u.name AS assignee, reporter_u.name AS sent_by,
              d.id::text AS document_id, d.file_name AS source_file_name
            FROM issues i
            LEFT JOIN project_members assignee_pm ON assignee_pm.id = i.assignee_member_id
            LEFT JOIN users assignee_u ON assignee_u.id = assignee_pm.user_id
            LEFT JOIN project_members reporter_pm ON reporter_pm.id = i.reporter_member_id
            LEFT JOIN users reporter_u ON reporter_u.id = reporter_pm.user_id
            LEFT JOIN documents d ON d.id = i.source_document_id AND d.deleted_at IS NULL
            WHERE i.project_id = CAST(:project_id AS uuid)
              AND i.source_type = 'ai'
              AND i.approval_status = 'pending'
              AND (
                (:is_lead AND i.reporter_member_id IS NOT NULL)
                OR (NOT :is_lead AND d.uploaded_by_member_id = CAST(:member_id AS uuid) AND i.reporter_member_id IS NULL)
              )
            ORDER BY COALESCE(i.updated_at, i.created_at) DESC
            """
        ),
        {"project_id": actor["project_id"], "member_id": actor["member_id"], "is_lead": _is_lead(actor)},
    )
    todos = [dict(row) for row in todo_result.mappings().all()]
    risks = [dict(row) for row in risk_result.mappings().all()]
    return {
        "role": "lead" if _is_lead(actor) else "member",
        "member_name": actor["name"],
        "todo_drafts": [item for item in todos if not item["sent_by"]],
        "pending_todos": [item for item in todos if item["sent_by"]],
        "risk_drafts": [item for item in risks if not item["sent_by"]],
        "pending_risks": [item for item in risks if item["sent_by"]],
    }


@router.post("/todos/send")
async def send_todos(
    body: ReviewBatch,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    actor = await _actor(db, authorization)
    sent = 0
    for item_id, item in body.items.items():
        result = await db.execute(
            text(
                """
                UPDATE todos
                SET title = :title,
                    description = :description,
                    priority = COALESCE(:priority, priority),
                    due_at = CAST(:due_at AS timestamptz),
                    assignee_member_id = (
                      SELECT pm.id FROM project_members pm
                      JOIN users u ON u.id = pm.user_id
                      WHERE pm.project_id = todos.project_id AND u.name = :assignee AND pm.status = 'active'
                      LIMIT 1
                    ),
                    created_by_member_id = CAST(:member_id AS uuid),
                    reviewed_by_member_id = CAST(:member_id AS uuid),
                    updated_at = now()
                WHERE id = CAST(:item_id AS uuid)
                  AND project_id = CAST(:project_id AS uuid)
                  AND approval_status = 'pending'
                  AND reviewed_by_member_id IS NULL
                  AND EXISTS (
                    SELECT 1 FROM documents d
                    WHERE d.id = todos.source_document_id
                      AND d.uploaded_by_member_id = CAST(:member_id AS uuid)
                  )
                """
            ),
            {
                "item_id": item_id, "project_id": actor["project_id"], "member_id": actor["member_id"],
                "title": item.title, "description": item.description, "priority": item.priority,
                "due_at": _due_at(item.due_at), "assignee": item.assignee,
            },
        )
        sent += result.rowcount
    await db.commit()
    if body.items and sent == 0:
        raise HTTPException(409, "Todo candidates were already processed or are not owned by this member")
    return {"status": "success", "sent": sent}


@router.post("/risks/send")
async def send_risks(
    body: ReviewBatch,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    actor = await _actor(db, authorization)
    sent = 0
    for item_id, item in body.items.items():
        result = await db.execute(
            text(
                """
                UPDATE issues
                SET title = :title,
                    description = :description,
                    severity = COALESCE(:severity, severity),
                    due_at = CAST(:due_at AS timestamptz),
                    assignee_member_id = (
                      SELECT pm.id FROM project_members pm
                      JOIN users u ON u.id = pm.user_id
                      WHERE pm.project_id = issues.project_id AND u.name = :assignee AND pm.status = 'active'
                      LIMIT 1
                    ),
                    reporter_member_id = CAST(:member_id AS uuid),
                    updated_at = now()
                WHERE id = CAST(:item_id AS uuid)
                  AND project_id = CAST(:project_id AS uuid)
                  AND approval_status = 'pending'
                  AND reporter_member_id IS NULL
                  AND EXISTS (
                    SELECT 1 FROM documents d
                    WHERE d.id = issues.source_document_id
                      AND d.uploaded_by_member_id = CAST(:member_id AS uuid)
                  )
                """
            ),
            {
                "item_id": item_id, "project_id": actor["project_id"], "member_id": actor["member_id"],
                "title": item.title, "description": item.description, "severity": item.severity,
                "due_at": _due_at(item.due_at), "assignee": item.assignee,
            },
        )
        sent += result.rowcount
    await db.commit()
    if body.items and sent == 0:
        raise HTTPException(409, "Risk candidates were already processed or are not owned by this member")
    return {"status": "success", "sent": sent}


@router.post("/risks/{issue_id}/reject")
async def reject_risk(
    issue_id: str,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    actor = await _actor(db, authorization)
    if not _is_lead(actor):
        raise HTTPException(403, "lead role required")
    result = await db.execute(
        text(
            """
            UPDATE issues
            SET approval_status = 'rejected', risk_reason = :reason, updated_at = now()
            WHERE id = CAST(:issue_id AS uuid) AND project_id = CAST(:project_id AS uuid)
            """
        ),
        {"issue_id": issue_id, "project_id": actor["project_id"], "reason": body.reason},
    )
    await db.commit()
    if not result.rowcount:
        raise HTTPException(404, "issue not found")
    return {"status": "success", "issue_id": issue_id}


@router.get("/risks/rejected")
async def rejected_risks(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    actor = await _actor(db, authorization)
    result = await db.execute(
        text(
            """
            SELECT i.id::text AS id, i.title, i.description, i.status, i.severity,
                   i.risk_reason, i.created_at, i.updated_at, u.name AS assignee,
                   d.id::text AS document_id, d.file_name AS source_file_name
            FROM issues i
            LEFT JOIN project_members pm ON pm.id = i.assignee_member_id
            LEFT JOIN users u ON u.id = pm.user_id
            LEFT JOIN documents d ON d.id = i.source_document_id AND d.deleted_at IS NULL
            WHERE i.project_id = CAST(:project_id AS uuid) AND i.approval_status = 'rejected'
            ORDER BY COALESCE(i.updated_at, i.created_at) DESC
            """
        ),
        {"project_id": actor["project_id"]},
    )
    return {"issues": [dict(row) for row in result.mappings().all()]}
