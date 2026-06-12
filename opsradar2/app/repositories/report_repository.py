"""Report persistence for the OpsRadar schema."""

from datetime import date, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class ReportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate(
        self,
        period: str,
        project_id: str | None = None,
        start_date: str | None = None,
    ) -> dict:
        selected_project = project_id or await self._default_project_id()
        if selected_project is None:
            raise ValueError("project is required")

        start, end = self._period_range(period, start_date)
        params = {"project_id": selected_project, "start": start, "end": end}
        summary = (
            await self.db.execute(
                text(
                    """
                    SELECT
                      (SELECT count(*) FROM todos WHERE project_id = CAST(:project_id AS uuid) AND created_at::date <= :end) AS total_todos,
                      (SELECT count(*) FROM todos WHERE project_id = CAST(:project_id AS uuid) AND status IN ('completed', 'done') AND updated_at::date BETWEEN :start AND :end) AS done_todos,
                      (SELECT count(*) FROM todos WHERE project_id = CAST(:project_id AS uuid) AND created_at::date <= :end AND (status IN ('pending', 'in_progress', 'blocked') OR updated_at::date > :end)) AS active_todos,
                      (SELECT count(*) FROM issues WHERE project_id = CAST(:project_id AS uuid) AND created_at::date <= :end AND (status <> 'resolved' OR updated_at::date > :end)) AS open_issues,
                      (SELECT count(*) FROM issues WHERE project_id = CAST(:project_id AS uuid) AND created_at::date <= :end AND (status <> 'resolved' OR updated_at::date > :end) AND severity IN ('high', 'critical')) AS high_issues,
                      (SELECT count(*) FROM calendar_events WHERE project_id = CAST(:project_id AS uuid) AND starts_at::date BETWEEN :start AND :end) AS upcoming_events
                    """
                ),
                params,
            )
        ).mappings().one()
        details = await self._period_details(selected_project, start, end)
        content = self._detailed_content(start, end, summary, details)
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

    async def delete(self, report_id: str) -> bool:
        weekly = await self.db.execute(
            text("DELETE FROM weekly_reports WHERE id = CAST(:report_id AS uuid)"),
            {"report_id": report_id},
        )
        deleted = weekly.rowcount > 0
        if not deleted:
            monthly = await self.db.execute(
                text("DELETE FROM monthly_reports WHERE id = CAST(:report_id AS uuid)"),
                {"report_id": report_id},
            )
            deleted = monthly.rowcount > 0
        await self.db.commit()
        return deleted

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
    def _period_range(period: str, start_date: str | None = None) -> tuple[date, date]:
        today = date.fromisoformat(start_date) if start_date else date.today()
        if period == "monthly":
            start = today.replace(day=1)
            next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
            return start, next_month - timedelta(days=1)

        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    async def _period_details(self, project_id: str, start: date, end: date) -> dict:
        params = {"project_id": project_id, "start": start, "end": end}
        completed = await self.db.execute(
            text(
                """
                SELECT title, description FROM todos
                WHERE project_id = CAST(:project_id AS uuid)
                  AND status IN ('completed', 'done')
                  AND updated_at::date BETWEEN :start AND :end
                ORDER BY updated_at DESC LIMIT 12
                """
            ),
            params,
        )
        active = await self.db.execute(
            text(
                """
                SELECT title, description, due_at FROM todos
                WHERE project_id = CAST(:project_id AS uuid)
                  AND created_at::date <= :end
                  AND (status IN ('pending', 'in_progress', 'blocked') OR updated_at::date > :end)
                ORDER BY due_at NULLS LAST, updated_at DESC LIMIT 12
                """
            ),
            params,
        )
        risks = await self.db.execute(
            text(
                """
                SELECT title, description, severity, status FROM issues
                WHERE project_id = CAST(:project_id AS uuid)
                  AND created_at::date <= :end
                  AND (status <> 'resolved' OR updated_at::date > :end)
                ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC
                LIMIT 10
                """
            ),
            params,
        )
        summaries = await self.db.execute(
            text(
                """
                SELECT summary FROM ai_summaries
                WHERE project_id = CAST(:project_id AS uuid)
                  AND created_at::date BETWEEN :start AND :end
                ORDER BY created_at DESC LIMIT 8
                """
            ),
            params,
        )
        return {
            "completed": [dict(row) for row in completed.mappings().all()],
            "active": [dict(row) for row in active.mappings().all()],
            "risks": [dict(row) for row in risks.mappings().all()],
            "technical": [str(row[0]) for row in summaries.all() if row[0]],
        }

    @staticmethod
    def _storage(period: str) -> tuple[str, str, str, str]:
        if period == "monthly":
            return "monthly_reports", "month_start", "month_end", "uq_monthly_reports_project_month"
        return "weekly_reports", "week_start", "week_end", "uq_weekly_reports_project_week"

    @staticmethod
    def _detailed_content(start: date, end: date, summary: Any, details: dict) -> str:
        def lines(items: list[str], empty: str) -> list[str]:
            return [f"- {item}" for item in items] or [f"- {empty}"]

        completed = [item["title"] for item in details["completed"]]
        active = [
            f'{item["title"]}' + (f' (마감 {item["due_at"].date().isoformat()})' if item.get("due_at") else "")
            for item in details["active"]
        ]
        risks = [
            f'[{str(item.get("severity") or "medium").upper()}] {item["title"]}: '
            f'{item.get("description") or "원인 확인 및 대응 계획 수립 필요"}'
            for item in details["risks"]
        ]
        technical = details["technical"]
        retrospective = [
            f"완료 {summary['done_todos']}건, 진행 {summary['active_todos']}건을 기준으로 실행 흐름을 점검했습니다.",
            f"미해결 이슈 {summary['open_issues']}건 중 고위험 {summary['high_issues']}건을 우선 관리해야 합니다.",
        ]
        next_plan = active[:6] + [f"미해결 리스크 대응: {item['title']}" for item in details["risks"][:4]]
        sections = [
            "# AI 운영 보고서 초안",
            f"기간: {start.isoformat()} ~ {end.isoformat()}",
            "",
            "## 완료된 업무",
            *lines(completed, "해당 기간에 완료 처리된 업무가 없습니다."),
            "",
            "## 진행 중인 업무",
            *lines(active, "해당 시점에 진행 중인 업무가 없습니다."),
            "",
            "## AI 및 기술적 상세 내용",
            *lines(technical, "해당 기간에 생성된 AI 분석 요약이 없습니다."),
            "",
            "## 리스크 관리 및 해결 방안",
            *lines(risks, "해당 시점의 미해결 리스크가 없습니다."),
            "",
            "## 팀 회고",
            *lines(retrospective, "회고 데이터가 없습니다."),
            "",
            "## 차주 계획",
            *lines(next_plan, "진행 업무와 미해결 리스크를 기준으로 차주 계획을 수립하세요."),
        ]
        return "\n".join(sections)
