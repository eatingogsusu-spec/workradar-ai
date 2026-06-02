"""Issue persistence for the v4 OpsRadar schema."""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class IssueRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: dict) -> dict:
        result = await self.db.execute(
            text(
                """
                INSERT INTO issues (
                  id, project_id, assignee_member_id, title, description,
                  severity, status, source_type, approval_status, domino_chain,
                  created_at, updated_at
                )
                SELECT
                  gen_random_uuid(),
                  selected_project.id,
                  pm.id,
                  :title,
                  :description,
                  COALESCE(:severity, 'medium'),
                  COALESCE(:status, 'open'),
                  'manual',
                  'approved',
                  :domino_impact,
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
                RETURNING
                  id::text AS id,
                  title,
                  description,
                  severity,
                  severity AS risk_level,
                  status,
                  'manual' AS source,
                  domino_chain AS domino_impact,
                  created_at
                """
            ),
            {
                "project_id": data.get("project_id"),
                "title": data["title"],
                "description": data.get("description"),
                "severity": data.get("severity"),
                "status": data.get("status"),
                "assignee": data.get("assignee"),
                "domino_impact": data.get("domino_impact"),
            },
        )
        await self.db.commit()
        return dict(result.mappings().one())

    async def get_all(self, status: Optional[str] = None, risk_level: Optional[str] = None) -> list[dict]:
        filters = ["i.approval_status <> 'rejected'"]
        params = {}
        if status:
            filters.append("i.status = :status")
            params["status"] = status
        if risk_level:
            filters.append("i.severity = :risk_level")
            params["risk_level"] = risk_level
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT
                  i.id::text AS id,
                  i.title,
                  i.description,
                  i.status,
                  i.severity,
                  i.severity AS risk_level,
                  CASE WHEN i.approval_status = 'pending' THEN 'ai' ELSE 'manual' END AS source,
                  i.confidence_score AS confidence,
                  u.name AS assignee,
                  dc.document_id::text AS document_id,
                  i.source_chunk_id::text AS source_chunk_id,
                  i.approval_status,
                  i.domino_chain AS domino_impact,
                  i.created_at,
                  i.updated_at
                FROM issues i
                LEFT JOIN project_members pm ON pm.id = i.assignee_member_id
                LEFT JOIN users u ON u.id = pm.user_id
                LEFT JOIN document_chunks dc ON dc.id = i.source_chunk_id
                {where_clause}
                ORDER BY i.created_at DESC
                """
            ),
            params,
        )
        return [dict(row) for row in result.mappings().all()]

    async def exists(self, issue_id: str) -> bool:
        result = await self.db.execute(
            text("SELECT EXISTS(SELECT 1 FROM issues WHERE id = CAST(:issue_id AS uuid))"),
            {"issue_id": issue_id},
        )
        return bool(result.scalar_one())

    async def update(self, issue_id: str, data: dict) -> bool:
        allowed = {key: value for key, value in data.items() if key in {"status", "approval_status"}}
        if not allowed:
            return True

        assignments = ", ".join(f"{key} = :{key}" for key in allowed)
        result = await self.db.execute(
            text(f"UPDATE issues SET {assignments}, updated_at = now() WHERE id = CAST(:issue_id AS uuid)"),
            {"issue_id": issue_id, **allowed},
        )
        await self.db.commit()
        return result.rowcount > 0

    async def resolve(self, issue_id: str) -> bool:
        return await self.update(issue_id, {"status": "resolved"})
