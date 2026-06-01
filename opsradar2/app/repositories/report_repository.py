"""Report persistence for the OpsRadar schema."""

from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ReportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate(self, period: str) -> dict:
        summary = (
            await self.db.execute(
                text(
                    """
                    SELECT
                      (SELECT count(*) FROM todos) AS total_todos,
                      (SELECT count(*) FROM todos WHERE status = 'completed') AS done_todos,
                      (SELECT count(*) FROM todos WHERE status IN ('pending', 'in_progress')) AS active_todos,
                      (SELECT count(*) FROM issues WHERE status <> 'resolved') AS open_issues,
                      (SELECT count(*) FROM issues WHERE status <> 'resolved' AND severity IN ('high', 'critical')) AS high_issues,
                      (SELECT count(*) FROM calendar_events WHERE starts_at::date >= current_date) AS upcoming_events
                    """
                )
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
                  (SELECT id FROM projects ORDER BY created_at LIMIT 1),
                  (SELECT id FROM project_members ORDER BY joined_at LIMIT 1),
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
                "start": start,
                "end": end,
                "content": content,
                "done_todos": int(summary["done_todos"]),
                "total_todos": int(summary["total_todos"]),
            },
        )
        await self.db.commit()
        return {
            "report_id": result.scalar_one(),
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

    async def get_all(self) -> list[dict]:
        result = await self.db.execute(
            text(
                """
                SELECT id::text AS id, 'weekly' AS period, week_start::text AS start_date,
                       week_end::text AS end_date, content, progress_rate, created_at
                FROM weekly_reports
                UNION ALL
                SELECT id::text AS id, 'monthly' AS period, month_start::text AS start_date,
                       month_end::text AS end_date, content, progress_rate, created_at
                FROM monthly_reports
                ORDER BY created_at DESC
                LIMIT 20
                """
            )
        )
        return [dict(row) for row in result.mappings().all()]

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
    def _content(start: date, end: date, summary) -> str:
        return "\n".join(
            [
                "# 운영 보고서 초안",
                f"기간: {start.isoformat()} ~ {end.isoformat()}",
                f"Todo 진행: 완료 {summary['done_todos']}건 / 전체 {summary['total_todos']}건",
                f"진행 중 또는 대기 Todo: {summary['active_todos']}건",
                f"미해결 이슈: {summary['open_issues']}건, High Risk: {summary['high_issues']}건",
                f"다가오는 캘린더 일정: {summary['upcoming_events']}건",
            ]
        )
