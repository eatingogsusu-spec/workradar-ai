"""Todo persistence for the v4 OpsRadar schema."""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class TodoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, status: Optional[str] = None, source: Optional[str] = None) -> list[dict]:
        filters = []
        params = {}
        if status:
            filters.append("t.status = :status")
            params["status"] = status
        if source:
            filters.append("t.source_type = :source")
            params["source"] = source
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT
                  t.id::text AS id,
                  t.title,
                  t.status,
                  t.priority,
                  u.name AS assignee,
                  t.source_type AS source,
                  t.confidence_score AS confidence,
                  dc.document_id::text AS document_id,
                  t.source_chunk_id::text AS source_chunk_id,
                  t.approval_status,
                  t.due_at,
                  t.created_at
                FROM todos t
                LEFT JOIN project_members pm ON pm.id = t.assignee_member_id
                LEFT JOIN users u ON u.id = pm.user_id
                LEFT JOIN document_chunks dc ON dc.id = t.source_chunk_id
                {where_clause}
                ORDER BY t.created_at DESC
                """
            ),
            params,
        )
        return [dict(row) for row in result.mappings().all()]

    async def create(self, data: dict) -> str:
        result = await self.db.execute(
            text(
                """
                INSERT INTO todos (
                  id, project_id, assignee_member_id, title, status, priority,
                  source_type, approval_status, confidence_score, due_at, linked_issue_id,
                  created_at, updated_at
                )
                SELECT
                  gen_random_uuid(),
                  selected_project.id,
                  pm.id,
                  :title,
                  COALESCE(:status, 'pending'),
                  COALESCE(:priority, 'medium'),
                  COALESCE(:source, 'manual'),
                  COALESCE(:approval_status, 'approved'),
                  :confidence,
                  CAST(:due_at AS timestamptz),
                  CAST(:linked_issue_id AS uuid),
                  now(),
                  now()
                FROM (
                  SELECT COALESCE(
                    CAST(:project_id AS uuid),
                    (SELECT id FROM projects ORDER BY created_at LIMIT 1)
                  ) AS id
                ) selected_project
                LEFT JOIN users u ON u.name = :assignee
                LEFT JOIN project_members pm
                  ON pm.project_id = selected_project.id
                 AND pm.user_id = u.id
                RETURNING id::text
                """
            ),
            {
                "project_id": data.get("project_id"),
                "title": data["title"],
                "status": data.get("status"),
                "priority": data.get("priority"),
                "source": data.get("source"),
                "approval_status": data.get("approval_status"),
                "confidence": data.get("confidence"),
                "due_at": data.get("due_at"),
                "linked_issue_id": data.get("linked_issue_id"),
                "assignee": data.get("assignee"),
            },
        )
        await self.db.commit()
        return result.scalar_one()

    async def update_status(self, todo_id: str, status: str) -> bool:
        return await self.update(todo_id, {"status": status})

    async def update(self, todo_id: str, data: dict) -> bool:
        allowed = {
            key: value
            for key, value in data.items()
            if key in {"title", "status", "priority", "approval_status"}
        }
        assignments = [f"{key} = :{key}" for key in allowed]
        params = {"todo_id": todo_id, **allowed}
        if "assignee" in data:
            assignments.append(
                """
                assignee_member_id = (
                  SELECT pm.id
                  FROM project_members pm
                  JOIN users u ON u.id = pm.user_id
                  WHERE pm.project_id = todos.project_id
                    AND u.name = :assignee
                  LIMIT 1
                )
                """
            )
            params["assignee"] = data["assignee"]
        if not assignments:
            return True
        result = await self.db.execute(
            text(
                f"""
                UPDATE todos
                SET {", ".join(assignments)}, updated_at = now()
                WHERE id = CAST(:todo_id AS uuid)
                """
            ),
            params,
        )
        await self.db.commit()
        return result.rowcount > 0
