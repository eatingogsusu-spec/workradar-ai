"""Dashboard aggregation service."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class DashboardService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def summary(self, project_id: str | None = None) -> dict:
        params = {"project_id": project_id} if project_id else {}
        todo_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""
        issue_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""
        summary_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""

        result = await self.db.execute(
            text(
                f"""
                SELECT
                  COUNT(*) FILTER (WHERE status = 'completed') AS done_todos,
                  COUNT(*) AS total_todos,
                  COUNT(*) FILTER (WHERE status = 'pending') AS pending_todos,
                  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_todos,
                  COUNT(*) FILTER (WHERE approval_status IN ('pending', 'needs_revision')) AS pending_review_todos,
                  COUNT(*) FILTER (WHERE source_chunk_id IS NULL) AS missing_evidence_todos,
                  COUNT(*) FILTER (WHERE assignee_member_id IS NULL) AS missing_assignee_todos,
                  COUNT(*) FILTER (WHERE due_at IS NULL) AS missing_due_date_todos
                FROM todos
                {todo_where}
                """
            ),
            params,
        )
        todo = dict(result.mappings().one())

        result = await self.db.execute(
            text(
                f"""
                SELECT
                  COUNT(*) FILTER (WHERE severity IN ('high', 'critical') AND status <> 'resolved') AS high_risk_count,
                  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_issues,
                  COUNT(*) FILTER (WHERE approval_status IN ('pending', 'needs_revision')) AS pending_review_issues,
                  COUNT(*) FILTER (WHERE source_chunk_id IS NULL) AS missing_evidence_issues,
                  COUNT(*) FILTER (WHERE assignee_member_id IS NULL) AS missing_assignee_issues,
                  COUNT(*) FILTER (WHERE due_at IS NULL) AS missing_due_date_issues
                FROM issues
                {issue_where}
                """
            ),
            params,
        )
        issue = dict(result.mappings().one())

        result = await self.db.execute(
            text(f"SELECT summary FROM ai_summaries {summary_where} ORDER BY created_at DESC LIMIT 1"),
            params,
        )
        ai_summary = result.scalar_one_or_none() or ""

        total_todos = int(todo["total_todos"] or 0)
        done_todos = int(todo["done_todos"] or 0)
        completion_rate = round((done_todos / total_todos) * 100) if total_todos else 0

        return {
            "done_todos": done_todos,
            "total_todos": total_todos,
            "pending_todos": int(todo["pending_todos"] or 0),
            "todo_completion_rate": completion_rate,
            "high_risk_count": int(issue["high_risk_count"] or 0),
            "blocked_count": int(todo["blocked_todos"] or 0) + int(issue["blocked_issues"] or 0),
            "pending_review_count": int(todo["pending_review_todos"] or 0) + int(issue["pending_review_issues"] or 0),
            "missing_evidence_count": int(todo["missing_evidence_todos"] or 0) + int(issue["missing_evidence_issues"] or 0),
            "missing_assignee_count": int(todo["missing_assignee_todos"] or 0) + int(issue["missing_assignee_issues"] or 0),
            "missing_due_date_count": int(todo["missing_due_date_todos"] or 0) + int(issue["missing_due_date_issues"] or 0),
            "ai_summary": ai_summary,
            "recent_activities": [],
        }
