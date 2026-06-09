"""Report persistence for the OpsRadar schema."""

from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ReportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate(self, period: str, project_id: str | None = None) -> dict:
        selected_project = project_id or await self._default_project_id()
        if selected_project is None:
            raise ValueError("project is required")

        summary = (
            await self.db.execute(
                text(
                    """
                    SELECT
                      (SELECT count(*) FROM todos WHERE project_id = CAST(:project_id AS uuid)) AS total_todos,
                      (
                        SELECT count(*)
                        FROM todos
                        WHERE project_id = CAST(:project_id AS uuid)
                          AND status IN ('completed', 'done')
                      ) AS done_todos,
                      (
                        SELECT count(*)
                        FROM todos
                        WHERE project_id = CAST(:project_id AS uuid)
                          AND status IN ('pending', 'in_progress', 'blocked')
                      ) AS active_todos,
                      (
                        SELECT count(*)
                        FROM issues
                        WHERE project_id = CAST(:project_id AS uuid)
                          AND status <> 'resolved'
                      ) AS open_issues,
                      (
                        SELECT count(*)
                        FROM issues
                        WHERE project_id = CAST(:project_id AS uuid)
                          AND status <> 'resolved'
                          AND severity IN ('high', 'critical')
                      ) AS high_issues,
                      (
                        SELECT count(*)
                        FROM calendar_events
                        WHERE project_id = CAST(:project_id AS uuid)
                          AND starts_at::date >= current_date
                      ) AS upcoming_events
                    """
                ),
                {"project_id": selected_project},
            )
        ).mappings().one()

        start, end = self._period_range(period)
        content = self._content(start, end, summary)
        table, start_column, end_column, constraint = self._storage(period)

        result = await self.db.execute(
            text(
                f"""
                INSERT INTO {table} (
                  id, project_id, created_by_member_id, {start_column}, {end_column},
                  content, progress_rate, created_at
                )
                VALUES (
                  gen_random_uuid(),
                  CAST(:project_id AS uuid),
                  (
                    SELECT id
                    FROM project_members
                    WHERE project_id = CAST(:project_id AS uuid)
                    ORDER BY joined_at
                    LIMIT 1
                  ),
                  CAST(:start AS date),
                  CAST(:end AS date),
                  :content,
                  CASE
                    WHEN :total_todos = 0 THEN 0
                    ELSE floor((CAST(:done_todos AS numeric) / CAST(:total_todos AS numeric)) * 100)::int
                  END,
                  now()
                )
                ON CONFLICT ON CONSTRAINT {constraint}
                DO UPDATE SET
                  content = EXCLUDED.content,
                  progress_rate = EXCLUDED.progress_rate,
                  created_at = now()
                RETURNING id::text AS report_id
                """
            ),
            {
                "project_id": selected_project,
                "start": start,
                "end": end,
                "content": content,
                "done_todos": int(summary["done_todos"] or 0),
                "total_todos": int(summary["total_todos"] or 0),
            },
        )
        await self.db.commit()

        return {
            "report_id": result.scalar_one(),
            "project_id": selected_project,
            "period": period,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "content": content,
        }

    async def update(self, report_id: str, content: str) -> bool:
        weekly = await self.db.execute(
            text(
                """
                UPDATE weekly_reports
                SET content = :content, created_at = now()
                WHERE id = CAST(:report_id AS uuid)
                """
            ),
            {"report_id": report_id, "content": content},
        )

        if weekly.rowcount == 0:
            monthly = await self.db.execute(
                text(
                    """
                    UPDATE monthly_reports
                    SET content = :content, created_at = now()
                    WHERE id = CAST(:report_id AS uuid)
                    """
                ),
                {"report_id": report_id, "content": content},
            )
            updated = monthly.rowcount > 0
        else:
            updated = True

        await self.db.commit()
        return updated

    async def get_all(self, project_id: str | None = None) -> list[dict]:
        params = {"project_id": project_id} if project_id else {}
        weekly_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""
        monthly_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""

        result = await self.db.execute(
            text(
                f"""
                SELECT id::text AS id, project_id::text AS project_id, 'weekly' AS period,
                       week_start::text AS start_date, week_end::text AS end_date,
                       content, progress_rate, created_at
                FROM weekly_reports
                {weekly_where}
                UNION ALL
                SELECT id::text AS id, project_id::text AS project_id, 'monthly' AS period,
                       month_start::text AS start_date, month_end::text AS end_date,
                       content, progress_rate, created_at
                FROM monthly_reports
                {monthly_where}
                ORDER BY created_at DESC
                LIMIT 20
                """
            ),
            params,
        )
        return [dict(row) for row in result.mappings().all()]

    async def review_check(self, project_id: str | None = None) -> dict:
        params = {"project_id": project_id} if project_id else {}
        todo_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""
        issue_where = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""

        todo = (
            await self.db.execute(
                text(
                    f"""
                    SELECT
                      COUNT(*) FILTER (WHERE source_chunk_id IS NOT NULL) AS with_evidence,
                      COUNT(*) FILTER (WHERE source_chunk_id IS NULL) AS missing_evidence,
                      COUNT(*) FILTER (WHERE assignee_member_id IS NULL) AS missing_assignee,
                      COUNT(*) FILTER (WHERE due_at IS NULL) AS missing_due_date
                    FROM todos
                    {todo_where}
                    """
                ),
                params,
            )
        ).mappings().one()
        issue = (
            await self.db.execute(
                text(
                    f"""
                    SELECT
                      COUNT(*) FILTER (WHERE source_chunk_id IS NOT NULL) AS with_evidence,
                      COUNT(*) FILTER (WHERE source_chunk_id IS NULL) AS missing_evidence,
                      COUNT(*) FILTER (WHERE assignee_member_id IS NULL) AS missing_assignee,
                      COUNT(*) FILTER (WHERE due_at IS NULL) AS missing_due_date,
                      COUNT(*) FILTER (WHERE severity IN ('high', 'critical') AND approval_status IN ('pending', 'needs_revision')) AS possible_conflicts
                    FROM issues
                    {issue_where}
                    """
                ),
                params,
            )
        ).mappings().one()

        return {
            "with_evidence": int(todo["with_evidence"] or 0) + int(issue["with_evidence"] or 0),
            "missing_evidence": int(todo["missing_evidence"] or 0) + int(issue["missing_evidence"] or 0),
            "missing_assignee": int(todo["missing_assignee"] or 0) + int(issue["missing_assignee"] or 0),
            "missing_due_date": int(todo["missing_due_date"] or 0) + int(issue["missing_due_date"] or 0),
            "possible_conflicts": int(issue["possible_conflicts"] or 0),
        }

    async def _default_project_id(self) -> str | None:
        result = await self.db.execute(text("SELECT id::text FROM projects ORDER BY created_at LIMIT 1"))
        return result.scalar_one_or_none()

    @staticmethod
    def _period_range(period: str) -> tuple[date, date]:
        today = date.today()
        if period == "monthly":
            start = today.replace(day=1)
            next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            return start, next_month - timedelta(days=1)

        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    @staticmethod
    def _storage(period: str) -> tuple[str, str, str, str]:
        if period == "monthly":
            return "monthly_reports", "month_start", "month_end", "uq_monthly_reports_project_month"
        return "weekly_reports", "week_start", "week_end", "uq_weekly_reports_project_week"

    @staticmethod
    def _content(start: date, end: date, summary: Any) -> str:
        return "\n".join(
            [
                "# Operations Report Draft",
                f"Period: {start.isoformat()} ~ {end.isoformat()}",
                f"Todo progress: {summary['done_todos']} done / {summary['total_todos']} total",
                f"Active todos: {summary['active_todos']}",
                f"Open issues: {summary['open_issues']} / High risk: {summary['high_issues']}",
                f"Upcoming calendar events: {summary['upcoming_events']}",
                "Next actions: review unfinished work, check due dates, and update handoff notes.",
            ]
        )
