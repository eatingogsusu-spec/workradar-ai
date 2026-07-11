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
        prepared = await self.prepare_generation(period, project_id=project_id, start_date=start_date)
        return await self.store_generated(prepared, self.fallback_content(prepared))

    async def prepare_generation(
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
        report_input = await self._report_input(selected_project, period, start, end, summary)
        return {
            "project_id": selected_project,
            "period": period,
            "start": start,
            "end": end,
            "summary": dict(summary),
            "details": details,
            "report_input": report_input,
        }

    async def store_generated(self, prepared: dict, content: str) -> dict:
        period = prepared["period"]
        selected_project = prepared["project_id"]
        start = prepared["start"]
        end = prepared["end"]
        summary = prepared["summary"]
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

    def fallback_content(self, prepared: dict) -> str:
        period = prepared["period"]
        report_input = prepared["report_input"]
        summary = prepared["summary"]
        start = prepared["start"]
        end = prepared["end"]
        todos = report_input["todos"]
        issues = report_input["issues"]
        documents = report_input["documents"]

        def clean(value: object, default: str = "확인 필요") -> str:
            text_value = " ".join(str(value or "").split())
            return text_value.replace("|", "/") if text_value else default

        def table(headers: list[str], rows: list[list[object]]) -> list[str]:
            output = [f"| {' | '.join(headers)} |", f"| {' | '.join(['---'] * len(headers))} |"]
            output.extend(f"| {' | '.join(clean(cell) for cell in row)} |" for row in rows)
            return output

        active_todos = [todo for todo in todos if todo["status_label"] != "완료"]
        completed_todos = [todo for todo in todos if todo["status_label"] == "완료"]
        unresolved_issues = [issue for issue in issues if issue["status_label"] != "완료"]
        high_issues = [issue for issue in unresolved_issues if issue["severity_label"] in {"High", "Critical"}]
        primary_issues = high_issues or unresolved_issues
        scope = report_input["scope"]["label"]

        if period == "monthly":
            lines = [
                "# 월간 운영 보고서",
                f"기간: {start.isoformat()} ~ {end.isoformat()}",
                f"보고 대상: {scope}",
                "",
                "## 1. 월간 핵심 요약",
                f"선택 기간 기준 완료 Todo는 {int(summary['done_todos'] or 0)}건, 진행 또는 미완료 Todo는 {int(summary['active_todos'] or 0)}건입니다.",
                f"미해결 Issue는 {int(summary['open_issues'] or 0)}건이며, 이 중 High 또는 Critical은 {int(summary['high_issues'] or 0)}건입니다.",
                "반복 여부와 운영 병목은 아래 Issue, Todo, 참고 자료의 근거를 기준으로 확인이 필요합니다.",
                "",
                "## 2. 주요 운영 이슈",
                *table(["이슈", "관련 대상", "등록일", "상태", "심각도", "영향 범위"], [
                    [issue["title"], issue["source"], issue["registered_at"], issue["status_label"], issue["severity_label"], issue["department"]]
                    for issue in primary_issues
                ] or [["해당 기간의 미해결 Issue가 없습니다.", "확인 필요", "-", "-", "-", "-"]]),
                "",
                "## 3. 월간 리스크 분석",
                *table(["리스크", "영향", "원인", "대응 방향"], [
                    [issue["title"], issue["description"], issue["risk_reason"], "담당 부서 확인 및 진행 Todo 추적"]
                    for issue in primary_issues
                ] or [["확인된 미해결 리스크가 없습니다.", "-", "-", "-"]]),
                "",
                "## 4. 부서별 진행 현황",
            ]
            departments: dict[str, list[str]] = {}
            for item in [*active_todos, *primary_issues]:
                department = clean(item.get("department"), "담당 부서 확인 필요")
                departments.setdefault(department, []).append(clean(item.get("title")))
            lines.extend(
                [f"- {department}: {', '.join(list(dict.fromkeys(items))[:4])}" for department, items in departments.items()]
                or ["- 입력 근거에서 부서별 진행 현황을 확인하지 못했습니다."]
            )
            lines.extend([
                "",
                "## 5. 완료된 업무",
                *([f"- {clean(todo['title'])} ({clean(todo['source'])})" for todo in completed_todos] or ["- 해당 기간에 완료 처리된 업무가 없습니다."]),
                "",
                "## 6. 미완료 업무",
                *table(["Todo", "담당", "우선순위", "다음 조치"], [
                    [todo["title"], todo["owner"], todo["priority_label"], "마감 및 상태 확인"]
                    for todo in active_todos
                ] or [["해당 기간의 미완료 Todo가 없습니다.", "-", "-", "-"]]),
                "",
                "## 7. 다음 달 관리 포인트",
                *([f"{index}. {clean(item['title'])} 상태와 담당 부서의 다음 조치를 확인" for index, item in enumerate([*active_todos, *primary_issues][:6], 1)] or ["1. 추가 운영 데이터 확인 필요"]),
                "",
                "## 8. 참고 자료",
                *([f"- [{clean(doc['title'])}](doc://{clean(doc['doc_id'])})" for doc in documents] or ["- 해당 기간에 연결된 문서가 없습니다."]),
            ])
            return "\n".join(lines)

        lines = [
            "# 주간 운영 보고서",
            f"기간: {start.isoformat()} ~ {end.isoformat()}",
            f"보고 대상: {scope}",
            "",
            "## 1. 주간 핵심 요약",
            f"이번 주 기준 완료 Todo는 {int(summary['done_todos'] or 0)}건, 진행 또는 미완료 Todo는 {int(summary['active_todos'] or 0)}건입니다.",
            f"미해결 Issue는 {int(summary['open_issues'] or 0)}건이며, High 또는 Critical Issue는 {int(summary['high_issues'] or 0)}건입니다.",
            "세부 영향과 우선 대응은 아래 근거 항목을 기준으로 확인해야 합니다.",
            "",
            "## 2. 주요 발생 이슈",
            *table(["구분", "내용", "등록일", "상태", "심각도", "관련 부서"], [
                ["Issue", issue["title"], issue["registered_at"], issue["status_label"], issue["severity_label"], issue["department"]]
                for issue in primary_issues
            ] or [["Issue", "해당 기간의 미해결 Issue가 없습니다.", "-", "-", "-", "-"]]),
            "",
            "## 3. 진행 중 Todo",
            *table(["Todo", "담당 부서 또는 담당자", "상태", "마감", "출처"], [
                [todo["title"], todo["owner"], todo["status_label"], todo["due_at"], todo["source"]]
                for todo in active_todos
            ] or [["해당 기간의 진행 Todo가 없습니다.", "-", "-", "-", "-"]]),
            "",
            "## 4. 미해결 리스크",
            *table(["리스크", "영향", "우선순위", "대응 필요사항"], [
                [issue["title"], issue["description"], issue["severity_label"], "담당 부서 확인 및 대응 Todo 추적"]
                for issue in primary_issues
            ] or [["확인된 미해결 리스크가 없습니다.", "-", "-", "-"]]),
            "",
            "## 5. 부서별 확인사항",
        ]
        departments: dict[str, list[str]] = {}
        for item in [*active_todos, *primary_issues]:
            department = clean(item.get("department"), "담당 부서 확인 필요")
            departments.setdefault(department, []).append(clean(item.get("title")))
        lines.extend(
            [f"- {department}: {', '.join(list(dict.fromkeys(items))[:4])} 확인 필요" for department, items in departments.items()]
            or ["- 입력 근거에서 부서별 확인사항을 찾지 못했습니다."]
        )
        lines.extend([
            "",
            "## 6. 다음 액션",
            *([f"{index}. {clean(item['title'])}의 상태와 다음 조치를 확인" for index, item in enumerate([*active_todos, *primary_issues][:6], 1)] or ["1. 추가 운영 데이터 확인 필요"]),
            "",
            "## 7. 참고 자료",
            *([f"- [{clean(doc['title'])}](doc://{clean(doc['doc_id'])})" for doc in documents] or ["- 해당 기간에 연결된 문서가 없습니다."]),
        ])
        return "\n".join(lines)

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

    async def _report_input(
        self,
        project_id: str,
        period: str,
        start: date,
        end: date,
        summary: Any,
    ) -> dict:
        params = {"project_id": project_id, "start": start, "end": end}
        todos_result = await self.db.execute(
            text(
                """
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
                  AND t.created_at::date <= :end
                  AND (
                    t.created_at::date BETWEEN :start AND :end
                    OR t.updated_at::date BETWEEN :start AND :end
                    OR t.due_at::date BETWEEN :start AND :end
                    OR COALESCE(t.status, '') NOT IN ('completed', 'done')
                  )
                ORDER BY
                  CASE lower(COALESCE(t.priority, 'medium'))
                    WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
                  END,
                  t.due_at NULLS LAST,
                  t.updated_at DESC
                LIMIT 30
                """
            ),
            params,
        )
        issues_result = await self.db.execute(
            text(
                """
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
                  AND i.created_at::date <= :end
                  AND (
                    i.created_at::date BETWEEN :start AND :end
                    OR i.updated_at::date BETWEEN :start AND :end
                    OR i.due_at::date BETWEEN :start AND :end
                    OR COALESCE(i.status, '') <> 'resolved'
                  )
                ORDER BY
                  CASE lower(COALESCE(i.severity, 'medium'))
                    WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3
                  END,
                  i.updated_at DESC
                LIMIT 24
                """
            ),
            params,
        )
        documents_result = await self.db.execute(
            text(
                """
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
                    d.created_at::date BETWEEN :start AND :end
                    OR EXISTS (
                      SELECT 1 FROM todos t
                      WHERE t.project_id = d.project_id
                        AND t.created_at::date <= :end
                        AND (
                          t.source_document_id = d.id
                          OR t.source_chunk_id IN (SELECT id FROM document_chunks WHERE document_id = d.id)
                        )
                    )
                    OR EXISTS (
                      SELECT 1 FROM issues i
                      WHERE i.project_id = d.project_id
                        AND i.created_at::date <= :end
                        AND (
                          i.source_document_id = d.id
                          OR i.source_chunk_id IN (SELECT id FROM document_chunks WHERE document_id = d.id)
                        )
                    )
                  )
                ORDER BY d.created_at DESC
                LIMIT 20
                """
            ),
            params,
        )

        weekly_reports: list[dict] = []
        if period == "monthly":
            weekly_result = await self.db.execute(
                text(
                    """
                    SELECT week_start::text AS start_date, week_end::text AS end_date,
                           left(content, 1800) AS content
                    FROM weekly_reports
                    WHERE project_id = CAST(:project_id AS uuid)
                      AND week_start <= CAST(:end AS date)
                      AND week_end >= CAST(:start AS date)
                    ORDER BY week_start
                    LIMIT 5
                    """
                ),
                params,
            )
            weekly_reports = [dict(row) for row in weekly_result.mappings().all()]

        todos = [self._todo_input(dict(row)) for row in todos_result.mappings().all()]
        issues = [self._issue_input(dict(row)) for row in issues_result.mappings().all()]
        documents = [
            {
                "doc_id": row["doc_id"],
                "title": self._short_text(row["title"], 180) or "확인 필요",
                "summary": self._short_text(row["summary"], 900) or "요약 없음",
            }
            for row in documents_result.mappings().all()
        ]
        return {
            "report_type": "monthly" if period == "monthly" else "weekly",
            "period": {"start": start.isoformat(), "end": end.isoformat()},
            "scope": {"type": "project_period", "label": "선택 기간의 전체 운영 현황"},
            "metrics": {key: int(value or 0) for key, value in dict(summary).items()},
            "business_entities": [
                {
                    "id": issue["id"],
                    "type": "issue",
                    "title": issue["title"],
                    "status": issue["status"],
                    "priority": issue["severity"],
                }
                for issue in issues
            ],
            "issues": issues,
            "todos": todos,
            "documents": documents,
            "weekly_reports": weekly_reports,
        }

    @staticmethod
    def _short_text(value: object, limit: int) -> str:
        normalized = " ".join(str(value or "").split())
        return normalized[:limit]

    @classmethod
    def _todo_input(cls, row: dict) -> dict:
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
        priority_label = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}.get(priority, "확인 필요")
        department = cls._short_text(row.get("dept") or row.get("assignee_team"), 120)
        assignee = cls._short_text(row.get("assignee_name"), 80)
        return {
            "id": row["id"],
            "title": cls._short_text(row.get("title"), 220) or "확인 필요",
            "description": cls._short_text(row.get("description"), 700) or "설명 확인 필요",
            "status": status,
            "status_label": status_label,
            "priority": priority,
            "priority_label": priority_label,
            "owner": department or assignee or "확인 필요",
            "department": department or "담당 부서 확인 필요",
            "assignee": assignee or "미지정",
            "due_at": row["due_at"].date().isoformat() if row.get("due_at") else "확인 필요",
            "source": cls._short_text(row.get("source"), 180) or "확인 필요",
        }

    @classmethod
    def _issue_input(cls, row: dict) -> dict:
        status = str(row.get("status") or "").lower()
        status_label = "완료" if status == "resolved" else "진행 중"
        severity = str(row.get("severity") or "medium").lower()
        severity_label = {"critical": "Critical", "high": "High", "medium": "Medium", "low": "Low"}.get(severity, "확인 필요")
        department = cls._short_text(row.get("dept") or row.get("assignee_team"), 120)
        created_at = row.get("created_at")
        registered_at = (
            created_at.date().isoformat()
            if hasattr(created_at, "date")
            else cls._short_text(created_at, 30) or "확인 필요"
        )
        return {
            "id": row["id"],
            "title": cls._short_text(row.get("title"), 220) or "확인 필요",
            "description": cls._short_text(row.get("description"), 700) or "영향 확인 필요",
            "status": status,
            "status_label": status_label,
            "severity": severity,
            "severity_label": severity_label,
            "department": department or "담당 부서 확인 필요",
            "assignee": cls._short_text(row.get("assignee_name"), 80) or "미지정",
            "risk_reason": cls._short_text(row.get("risk_reason"), 500) or "원인 확인 필요",
            "source": cls._short_text(row.get("source"), 180) or "확인 필요",
            "registered_at": registered_at,
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
