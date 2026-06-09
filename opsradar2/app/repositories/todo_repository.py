"""Todo persistence for the v4 OpsRadar schema."""

from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

_COLUMNS_CACHE: dict[str, set[str]] = {}


class TodoRepository:
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

    async def count(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> int:
        todo_columns = await self._columns("todos")
        filters = []
        params: dict = {}
        if project_id and "project_id" in todo_columns:
            filters.append("project_id = CAST(:project_id AS uuid)")
            params["project_id"] = project_id
        if status:
            filters.append("status = :status")
            params["status"] = status
        if source and "source_type" in todo_columns:
            filters.append("source_type = :source")
            params["source"] = source
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
        result = await self.db.execute(
            text(f"SELECT COUNT(*) FROM todos {where_clause}"),
            params,
        )
        return result.scalar_one()

    async def get_all(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None,
        project_id: Optional[str] = None,
        limit: int = 15,
        offset: int = 0,
    ) -> list[dict]:
        todo_columns = await self._columns("todos")
        chunk_columns = await self._columns("document_chunks")
        document_columns = await self._columns("documents")

        filters = []
        params = {}
        if project_id and "project_id" in todo_columns:
            filters.append("t.project_id = CAST(:project_id AS uuid)")
            params["project_id"] = project_id
        if status:
            filters.append("t.status = :status")
            params["status"] = status
        if source and "source_type" in todo_columns:
            filters.append("t.source_type = :source")
            params["source"] = source
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

        source_expr = "t.source_type" if "source_type" in todo_columns else "'manual'"
        confidence_expr = "t.confidence_score" if "confidence_score" in todo_columns else "NULL::integer"
        approval_expr = "t.approval_status" if "approval_status" in todo_columns else "'approved'"
        due_expr = "t.due_at" if "due_at" in todo_columns else "t.due_date" if "due_date" in todo_columns else "NULL::timestamptz"
        source_chunk_expr = "t.source_chunk_id::text" if "source_chunk_id" in todo_columns else "NULL::text"
        description_expr = "t.description" if "description" in todo_columns else "NULL::text"
        evidence_snippet_expr = (
            "dc.content"
            if "source_chunk_id" in todo_columns and "content" in chunk_columns
            else "NULL::text"
        )
        evidence_section_expr = (
            "dc.section_title"
            if "source_chunk_id" in todo_columns and "section_title" in chunk_columns
            else "NULL::text"
        )

        joins = []
        assignee_expr = "NULL::text"
        if "assignee_member_id" in todo_columns:
            joins.append("LEFT JOIN project_members pm ON pm.id = t.assignee_member_id")
            joins.append("LEFT JOIN users u ON u.id = pm.user_id")
            assignee_expr = "u.name"
        elif "assignee_id" in todo_columns:
            joins.append("LEFT JOIN users u ON u.id = t.assignee_id")
            assignee_expr = "u.name"

        document_expr = "NULL::text"
        source_file_expr = "NULL::text"
        source_uploaded_expr = "NULL::timestamptz"
        direct_document_expr = "t.source_document_id" if "source_document_id" in todo_columns else "NULL::uuid"
        chunk_document_expr = "dc.document_id" if "source_chunk_id" in todo_columns and "document_id" in chunk_columns else "NULL::uuid"
        if "source_chunk_id" in todo_columns and "document_id" in chunk_columns:
            joins.append("LEFT JOIN document_chunks dc ON dc.id = t.source_chunk_id")
        if "source_document_id" in todo_columns or ("source_chunk_id" in todo_columns and "document_id" in chunk_columns):
            document_expr = f"COALESCE({direct_document_expr}, {chunk_document_expr})::text"
        if {"id", "file_name", "created_at"}.issubset(document_columns):
            joins.append(f"LEFT JOIN documents d ON d.id = COALESCE({direct_document_expr}, {chunk_document_expr})")
            source_file_expr = "d.file_name"
            source_uploaded_expr = "d.created_at"

        joins_sql = "\n                ".join(joins)

        result = await self.db.execute(
            text(
                f"""
                SELECT
                  t.id::text AS id,
                  t.title,
                  {description_expr} AS description,
                  t.status,
                  t.priority,
                  {assignee_expr} AS assignee,
                  {source_expr} AS source,
                  {confidence_expr} AS confidence,
                  {document_expr} AS document_id,
                  {source_file_expr} AS source_file_name,
                  {source_uploaded_expr} AS source_uploaded_at,
                  {source_chunk_expr} AS source_chunk_id,
                  {evidence_snippet_expr} AS evidence_snippet,
                  {evidence_section_expr} AS evidence_section,
                  {approval_expr} AS approval_status,
                  {due_expr} AS due_at,
                  t.created_at
                FROM todos t
                {joins_sql}
                {where_clause}
                ORDER BY t.created_at DESC
                LIMIT :limit OFFSET :offset
                """
            ),
            {**params, "limit": limit, "offset": offset},
        )
        todos = []
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
            todos.append(item)
        return todos

    async def create(self, data: dict) -> str:
        result = await self.db.execute(
            text(
                """
                INSERT INTO todos (
                  id, project_id, assignee_member_id, created_by_member_id,
                  source_document_id, source_chunk_id, linked_issue_id,
                  title, description, status, priority,
                  source_type, approval_status, confidence_score, due_at,
                  created_at, updated_at
                )
                SELECT
                  gen_random_uuid(),
                  selected_project.id,
                  pm.id,
                  creator_pm.id,
                  CAST(:source_document_id AS uuid),
                  CAST(:source_chunk_id AS uuid),
                  CAST(:linked_issue_id AS uuid),
                  :title,
                  :description,
                  COALESCE(:status, 'pending'),
                  COALESCE(:priority, 'medium'),
                  COALESCE(:source, 'manual'),
                  COALESCE(:approval_status, 'approved'),
                  :confidence,
                  CAST(:due_at AS timestamptz),
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
                LEFT JOIN users creator_u ON creator_u.name = :created_by
                LEFT JOIN project_members creator_pm
                  ON creator_pm.project_id = selected_project.id
                 AND creator_pm.user_id = creator_u.id
                RETURNING id::text
                """
            ),
            {
                "project_id": data.get("project_id"),
                "title": data["title"],
                "description": data.get("description"),
                "status": data.get("status"),
                "priority": data.get("priority"),
                "source": data.get("source"),
                "approval_status": data.get("approval_status"),
                "confidence": data.get("confidence"),
                "due_at": data.get("due_at"),
                "linked_issue_id": data.get("linked_issue_id"),
                "source_document_id": data.get("source_document_id"),
                "source_chunk_id": data.get("source_chunk_id"),
                "assignee": data.get("assignee"),
                "created_by": data.get("created_by"),
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
            if key in {"title", "description", "status", "priority", "approval_status", "due_at"}
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
                    AND pm.status = 'active'
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

    async def delete(self, todo_id: str) -> bool:
        result = await self.db.execute(
            text(
                """
                DELETE FROM todos
                WHERE id = CAST(:todo_id AS uuid)
                """
            ),
            {"todo_id": todo_id},
        )
        await self.db.commit()
        return result.rowcount > 0
