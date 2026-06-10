"""Issue persistence for the v4 OpsRadar schema."""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

_COLUMNS_CACHE: dict[str, set[str]] = {}


class IssueRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _columns(self, table_name: str) -> set[str]:
        if table_name in _COLUMNS_CACHE:
            return _COLUMNS_CACHE[table_name]
        result = await self.db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = :schema
                  AND table_name = :table_name
                """
            ),
            {"schema": settings.DB_SCHEMA, "table_name": table_name},
        )
        _COLUMNS_CACHE[table_name] = {row[0] for row in result.all()}
        return _COLUMNS_CACHE[table_name]

    async def create(self, data: dict) -> dict:
        result = await self.db.execute(
            text(
                """
                INSERT INTO issues (
                  id, project_id, assignee_member_id, reporter_member_id,
                  source_document_id, source_chunk_id, title, description,
                  severity, status, source_type, approval_status,
                  confidence_score, is_candidate, risk_reason, domino_chain,
                  created_at, updated_at
                )
                SELECT
                  gen_random_uuid(),
                  selected_project.id,
                  pm.id,
                  reporter_pm.id,
                  CAST(:source_document_id AS uuid),
                  CAST(:source_chunk_id AS uuid),
                  :title,
                  :description,
                  COALESCE(:severity, 'medium'),
                  COALESCE(:status, 'open'),
                  COALESCE(:source, 'manual'),
                  COALESCE(:approval_status, 'approved'),
                  :confidence,
                  COALESCE(:is_candidate, false),
                  :risk_reason,
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
                LEFT JOIN users reporter_u ON reporter_u.name = :reporter
                LEFT JOIN project_members reporter_pm
                  ON reporter_pm.project_id = selected_project.id
                 AND reporter_pm.user_id = reporter_u.id
                RETURNING
                  id::text AS id,
                  title,
                  description,
                  severity,
                  severity AS risk_level,
                  status,
                  source_type AS source,
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
                "source": data.get("source"),
                "approval_status": data.get("approval_status"),
                "confidence": data.get("confidence"),
                "is_candidate": data.get("is_candidate"),
                "risk_reason": data.get("risk_reason"),
                "source_document_id": data.get("source_document_id"),
                "source_chunk_id": data.get("source_chunk_id"),
                "assignee": data.get("assignee"),
                "reporter": data.get("reporter"),
                "domino_impact": data.get("domino_impact"),
            },
        )
        await self.db.commit()
        return dict(result.mappings().one())

    async def count(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> int:
        issue_columns = await self._columns("issues")
        filters = []
        params: dict = {}
        if project_id and "project_id" in issue_columns:
            filters.append("project_id = CAST(:project_id AS uuid)")
            params["project_id"] = project_id
        if "approval_status" in issue_columns:
            filters.append("approval_status <> 'rejected'")
        if status:
            filters.append("status = :status")
            params["status"] = status
        if risk_level:
            filters.append("severity = :risk_level")
            params["risk_level"] = risk_level
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
        result = await self.db.execute(
            text(f"SELECT COUNT(*) FROM issues {where_clause}"),
            params,
        )
        return result.scalar_one()

    async def get_all(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 15,
        offset: int = 0,
    ) -> list[dict]:
        issue_columns = await self._columns("issues")
        chunk_columns = await self._columns("document_chunks")
        document_columns = await self._columns("documents")

        filters = []
        params = {}
        if project_id and "project_id" in issue_columns:
            filters.append("i.project_id = CAST(:project_id AS uuid)")
            params["project_id"] = project_id
        if "approval_status" in issue_columns:
            filters.append("i.approval_status <> 'rejected'")
        if status:
            filters.append("i.status = :status")
            params["status"] = status
        if risk_level:
            filters.append("i.severity = :risk_level")
            params["risk_level"] = risk_level
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

        if "approval_status" in issue_columns:
            approval_expr = "i.approval_status"
        elif "is_candidate" in issue_columns:
            approval_expr = "CASE WHEN i.is_candidate THEN 'pending' ELSE 'approved' END"
        else:
            approval_expr = "'approved'"

        description_expr = "i.description" if "description" in issue_columns else "NULL::text"
        source_expr = "i.source_type" if "source_type" in issue_columns else "'manual'"
        confidence_expr = "i.confidence_score" if "confidence_score" in issue_columns else "NULL::integer"
        updated_at_expr = "i.updated_at" if "updated_at" in issue_columns else "i.created_at"
        source_chunk_expr = "i.source_chunk_id::text" if "source_chunk_id" in issue_columns else "NULL::text"
        domino_expr = "i.domino_chain" if "domino_chain" in issue_columns else "NULL::text"
        due_expr = "i.due_at" if "due_at" in issue_columns else "NULL::timestamptz"
        evidence_snippet_expr = (
            "dc.content"
            if "source_chunk_id" in issue_columns and "content" in chunk_columns
            else "NULL::text"
        )
        evidence_section_expr = (
            "dc.section_title"
            if "source_chunk_id" in issue_columns and "section_title" in chunk_columns
            else "NULL::text"
        )

        joins = []
        assignee_expr = "NULL::text"
        if "assignee_member_id" in issue_columns:
            joins.append("LEFT JOIN project_members pm ON pm.id = i.assignee_member_id")
            joins.append("LEFT JOIN users u ON u.id = pm.user_id")
            assignee_expr = "u.name"
        elif "assignee_id" in issue_columns:
            joins.append("LEFT JOIN users u ON u.id = i.assignee_id")
            assignee_expr = "u.name"

        direct_document_expr = "i.source_document_id" if "source_document_id" in issue_columns else "NULL::uuid"
        chunk_document_expr = "dc.document_id" if "source_chunk_id" in issue_columns and "document_id" in chunk_columns else "NULL::uuid"
        document_expr = "NULL::text"
        source_file_expr = "NULL::text"
        if "source_chunk_id" in issue_columns and "document_id" in chunk_columns:
            joins.append("LEFT JOIN document_chunks dc ON dc.id = i.source_chunk_id")
        if "source_document_id" in issue_columns or ("source_chunk_id" in issue_columns and "document_id" in chunk_columns):
            document_expr = f"COALESCE({direct_document_expr}, {chunk_document_expr})::text"
        if {"id", "file_name"}.issubset(document_columns):
            joins.append(f"LEFT JOIN documents d ON d.id = COALESCE({direct_document_expr}, {chunk_document_expr})")
            source_file_expr = "d.file_name"

        joins_sql = "\n                ".join(joins)

        result = await self.db.execute(
            text(
                f"""
                SELECT
                  i.id::text AS id,
                  i.title,
                  {description_expr} AS description,
                  i.status,
                  i.severity,
                  i.severity AS risk_level,
                  {source_expr} AS source,
                  {confidence_expr} AS confidence,
                  {assignee_expr} AS assignee,
                  {document_expr} AS document_id,
                  {source_file_expr} AS source_file_name,
                  {source_chunk_expr} AS source_chunk_id,
                  {evidence_snippet_expr} AS evidence_snippet,
                  {evidence_section_expr} AS evidence_section,
                  {approval_expr} AS approval_status,
                  {domino_expr} AS domino_impact,
                  {due_expr} AS due_at,
                  i.created_at,
                  {updated_at_expr} AS updated_at
                FROM issues i
                {joins_sql}
                {where_clause}
                ORDER BY i.created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {**params, "limit": limit, "offset": offset},
        )
        issues = []
        for row in result.mappings().all():
            item = dict(row)
            evidence_snippet = item.pop("evidence_snippet", None)
            evidence_section = item.pop("evidence_section", None)
            has_evidence = bool(item.get("source_chunk_id") or evidence_snippet)
            missing_assignee = not bool(item.get("assignee"))
            missing_due_date = item.get("due_at") is None
            item["evidence"] = {
                "document_id": item.get("document_id"),
                "file_name": item.get("source_file_name"),
                "chunk_id": item.get("source_chunk_id"),
                "section": evidence_section,
                "snippet": evidence_snippet,
            }
            item["review"] = {
                "approval_status": item.get("approval_status"),
                "has_evidence": has_evidence,
                "missing_evidence": not has_evidence,
                "missing_assignee": missing_assignee,
                "missing_due_date": missing_due_date,
            }
            issues.append(item)
        return issues

    async def exists(self, issue_id: str) -> bool:
        result = await self.db.execute(
            text("SELECT EXISTS(SELECT 1 FROM issues WHERE id = CAST(:issue_id AS uuid))"),
            {"issue_id": issue_id},
        )
        return bool(result.scalar_one())

    async def update(self, issue_id: str, data: dict) -> bool:
        normalized = dict(data)
        if "risk_level" in normalized and "severity" not in normalized:
            normalized["severity"] = normalized["risk_level"]
        allowed = {
            key: value
            for key, value in normalized.items()
            if key in {"title", "description", "status", "severity", "approval_status"}
        }
        assignments = [f"{key} = :{key}" for key in allowed]
        params = {"issue_id": issue_id, **allowed}
        if "assignee" in normalized:
            assignments.append(
                """
                assignee_member_id = (
                  SELECT pm.id
                  FROM project_members pm
                  JOIN users u ON u.id = pm.user_id
                  WHERE pm.project_id = issues.project_id
                    AND u.name = :assignee
                    AND pm.status = 'active'
                  LIMIT 1
                )
                """
            )
            params["assignee"] = normalized.get("assignee")
        if not assignments:
            return True

        result = await self.db.execute(
            text(
                f"""
                UPDATE issues
                SET {", ".join(assignments)}, updated_at = now()
                WHERE id = CAST(:issue_id AS uuid)
                """
            ),
            params,
        )
        await self.db.commit()
        return result.rowcount > 0
    async def resolve(self, issue_id: str) -> bool:
        return await self.update(issue_id, {"status": "resolved"})

    async def delete(self, issue_id: str) -> bool:
        result = await self.db.execute(
            text("DELETE FROM issues WHERE id = CAST(:issue_id AS uuid)"),
            {"issue_id": issue_id},
        )
        await self.db.commit()
        return result.rowcount > 0
