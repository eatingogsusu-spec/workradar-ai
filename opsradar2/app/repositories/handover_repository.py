"""Handover grounding data — assembles selected todo/issue IDs into LLM-ready dict.

JOIN pattern mirrors report_repository._report_input(). Only the WHERE clause
differs: we filter by explicit ID lists instead of a date range.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _short_text(value: object, limit: int) -> str:
    normalized = " ".join(str(value or "").split())
    return normalized[:limit]


def _todo_input(row: dict) -> dict:
    status = str(row.get("status") or "").lower()
    if status in {"completed", "done"}:
        status_label = "완료"
    elif status in {"pending", "approval_pending"}:
        status_label = "승인 대기"
    elif status == "blocked":
        status_label = "Blocked"
    else:
        status_label = "진행 중"
    priority = str(row.get("priority") or "medium").lower()
    priority_label = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}.get(
        priority, "확인 필요"
    )
    department = _short_text(row.get("dept") or row.get("assignee_team"), 120)
    assignee = _short_text(row.get("assignee_name"), 80)
    return {
        "id": row["id"],
        "title": _short_text(row.get("title"), 220) or "확인 필요",
        "description": _short_text(row.get("description"), 700) or "설명 확인 필요",
        "status": status,
        "status_label": status_label,
        "priority": priority,
        "priority_label": priority_label,
        "department": department or "담당 부서 확인 필요",
        "assignee": assignee or "미지정",
        "due_at": row["due_at"].date().isoformat() if row.get("due_at") else "확인 필요",
        "source": _short_text(row.get("source"), 180) or "확인 필요",
    }


def _issue_input(row: dict) -> dict:
    status = str(row.get("status") or "").lower()
    status_label = "완료" if status == "resolved" else "진행 중"
    severity = str(row.get("severity") or "medium").lower()
    severity_label = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}.get(
        severity, "확인 필요"
    )
    department = _short_text(row.get("dept") or row.get("assignee_team"), 120)
    created_at = row.get("created_at")
    registered_at = (
        created_at.date().isoformat()
        if hasattr(created_at, "date")
        else _short_text(created_at, 30) or "확인 필요"
    )
    return {
        "id": row["id"],
        "title": _short_text(row.get("title"), 220) or "확인 필요",
        "description": _short_text(row.get("description"), 700) or "영향 확인 필요",
        "status": status,
        "status_label": status_label,
        "severity": severity,
        "severity_label": severity_label,
        "department": department or "담당 부서 확인 필요",
        "assignee": _short_text(row.get("assignee_name"), 80) or "미지정",
        "risk_reason": _short_text(row.get("risk_reason"), 500) or "원인 확인 필요",
        "source": _short_text(row.get("source"), 180) or "확인 필요",
        "registered_at": registered_at,
    }


async def gather_handover_input(
    db: AsyncSession,
    *,
    project_id: str,
    owner: str,
    receiver: str,
    todo_ids: list[str],
    issue_ids: list[str],
) -> dict:
    """Return grounding dict with todos, issues, and linked documents."""

    # ── todos ──────────────────────────────────────────────────────────────
    todos: list[dict] = []
    if todo_ids:
        params: dict = {"project_id": project_id}
        placeholders = []
        for i, tid in enumerate(todo_ids):
            key = f"tid_{i}"
            params[key] = tid
            placeholders.append(f"CAST(:{key} AS uuid)")
        in_clause = f"({', '.join(placeholders)})"

        result = await db.execute(
            text(f"""
                SELECT
                  t.id::text AS id, t.title, t.description, t.status, t.approval_status,
                  t.priority, t.due_at, t.created_at, t.updated_at,
                  assignee.name AS assignee_name, assignee_team.name AS assignee_team,
                  COALESCE(d.file_name, t.source_document_id::text, t.source_chunk_id::text, '확인 필요') AS source
                FROM todos t
                LEFT JOIN project_members assignee_pm ON assignee_pm.id = t.assignee_member_id
                LEFT JOIN users assignee ON assignee.id = assignee_pm.user_id
                LEFT JOIN teams assignee_team ON assignee_team.id = assignee_pm.team_id
                LEFT JOIN document_chunks dc ON dc.id = t.source_chunk_id
                LEFT JOIN documents d ON d.id = COALESCE(t.source_document_id, dc.document_id)
                WHERE t.project_id = CAST(:project_id AS uuid)
                  AND t.id IN {in_clause}
                ORDER BY
                  CASE lower(COALESCE(t.priority, 'medium'))
                    WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
                  END,
                  t.due_at NULLS LAST
            """),
            params,
        )
        todos = [_todo_input(dict(row)) for row in result.mappings().all()]

    # ── issues ─────────────────────────────────────────────────────────────
    issues: list[dict] = []
    if issue_ids:
        iparams: dict = {"project_id": project_id}
        iplaceholders = []
        for i, iid in enumerate(issue_ids):
            key = f"iid_{i}"
            iparams[key] = iid
            iplaceholders.append(f"CAST(:{key} AS uuid)")
        i_in_clause = f"({', '.join(iplaceholders)})"

        iresult = await db.execute(
            text(f"""
                SELECT
                  i.id::text AS id, i.title, i.description, i.status, i.approval_status,
                  i.severity, i.risk_reason, i.due_at, i.created_at, i.updated_at,
                  assignee.name AS assignee_name, assignee_team.name AS assignee_team,
                  COALESCE(d.file_name, i.source_document_id::text, i.source_chunk_id::text, '확인 필요') AS source
                FROM issues i
                LEFT JOIN project_members assignee_pm ON assignee_pm.id = i.assignee_member_id
                LEFT JOIN users assignee ON assignee.id = assignee_pm.user_id
                LEFT JOIN teams assignee_team ON assignee_team.id = assignee_pm.team_id
                LEFT JOIN document_chunks dc ON dc.id = i.source_chunk_id
                LEFT JOIN documents d ON d.id = COALESCE(i.source_document_id, dc.document_id)
                WHERE i.project_id = CAST(:project_id AS uuid)
                  AND i.id IN {i_in_clause}
                ORDER BY
                  CASE lower(COALESCE(i.severity, 'medium'))
                    WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
                  END,
                  i.updated_at DESC
            """),
            iparams,
        )
        issues = [_issue_input(dict(row)) for row in iresult.mappings().all()]

    # ── documents (source docs of selected items) ───────────────────────────
    documents: list[dict] = []
    all_ids = todo_ids + issue_ids
    if all_ids:
        dparams: dict = {"project_id": project_id}
        dall_placeholders = []
        for i, aid in enumerate(all_ids):
            key = f"aiid_{i}"
            dparams[key] = aid
            dall_placeholders.append(f"CAST(:{key} AS uuid)")
        dall_in = f"({', '.join(dall_placeholders)})"

        dresult = await db.execute(
            text(f"""
                SELECT
                  d.id::text AS doc_id,
                  d.file_name AS title,
                  COALESCE(summary.summary, '') AS summary
                FROM documents d
                LEFT JOIN LATERAL (
                  SELECT ais.summary
                  FROM ai_summaries ais
                  WHERE ais.document_id = d.id
                  ORDER BY ais.created_at DESC
                  LIMIT 1
                ) summary ON true
                WHERE d.project_id = CAST(:project_id AS uuid)
                  AND d.deleted_at IS NULL
                  AND (
                    EXISTS (
                      SELECT 1 FROM todos t
                      WHERE t.id IN {dall_in}
                        AND (
                          t.source_document_id = d.id
                          OR t.source_chunk_id IN (SELECT id FROM document_chunks WHERE document_id = d.id)
                        )
                    )
                    OR EXISTS (
                      SELECT 1 FROM issues i
                      WHERE i.id IN {dall_in}
                        AND (
                          i.source_document_id = d.id
                          OR i.source_chunk_id IN (SELECT id FROM document_chunks WHERE document_id = d.id)
                        )
                    )
                  )
                ORDER BY d.created_at DESC
                LIMIT 15
            """),
            dparams,
        )
        documents = [
            {
                "doc_id": row["doc_id"],
                "title": _short_text(row["title"], 180) or "확인 필요",
                "summary": _short_text(row["summary"], 900) or "요약 없음",
            }
            for row in dresult.mappings().all()
        ]

    return {
        "owner": owner,
        "receiver": receiver,
        "todos": todos,
        "issues": issues,
        "documents": documents,
    }
