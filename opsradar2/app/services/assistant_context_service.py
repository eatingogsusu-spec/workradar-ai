"""Build operational context for the AI assistant from OpsRadar data."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class AssistantContextService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_context(self, *, project_id: str | None = None) -> tuple[str, list[dict]]:
        params = {"project_id": project_id} if project_id else {}
        project_filter = "WHERE project_id = CAST(:project_id AS uuid)" if project_id else ""
        todo_filter = "WHERE t.project_id = CAST(:project_id AS uuid)" if project_id else ""
        issue_filter = "WHERE i.project_id = CAST(:project_id AS uuid)" if project_id else ""
        calendar_filter = "WHERE ce.project_id = CAST(:project_id AS uuid)" if project_id else ""

        todos = (
            await self.db.execute(
                text(
                    f"""
                    SELECT title, status, priority, due_at, created_at
                    FROM todos t
                    {todo_filter}
                    ORDER BY
                      CASE WHEN status IN ('blocked', 'pending', 'in_progress') THEN 0 ELSE 1 END,
                      created_at DESC
                    LIMIT 8
                    """
                ),
                params,
            )
        ).mappings().all()

        issues = (
            await self.db.execute(
                text(
                    f"""
                    SELECT title, status, severity, description, created_at
                    FROM issues i
                    {issue_filter}
                    ORDER BY
                      CASE WHEN severity IN ('critical', 'high') THEN 0 ELSE 1 END,
                      created_at DESC
                    LIMIT 8
                    """
                ),
                params,
            )
        ).mappings().all()

        events = (
            await self.db.execute(
                text(
                    f"""
                    SELECT title, event_type, starts_at, created_at
                    FROM calendar_events ce
                    {calendar_filter}
                    ORDER BY starts_at ASC
                    LIMIT 8
                    """
                ),
                params,
            )
        ).mappings().all()

        summary = (
            await self.db.execute(
                text(
                    f"""
                    SELECT summary
                    FROM ai_summaries
                    {project_filter}
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                params,
            )
        ).scalar_one_or_none()

        lines = ["[OpsRadar current operational data]"]
        sources = []

        if summary:
            lines.append(f"\nAI summary:\n- {summary}")
            sources.append({"title": "AI summary", "type": "summary"})

        lines.append("\nTodos:")
        if todos:
            for row in todos:
                due = row["due_at"].isoformat() if row["due_at"] else "no due date"
                lines.append(f"- {row['title']} | status={row['status']} | priority={row['priority']} | due={due}")
            sources.append({"title": "Todo data", "type": "todos", "count": len(todos)})
        else:
            lines.append("- no todos found")

        lines.append("\nIssues:")
        if issues:
            for row in issues:
                description = f" | {row['description']}" if row["description"] else ""
                lines.append(f"- {row['title']} | status={row['status']} | severity={row['severity']}{description}")
            sources.append({"title": "Issue data", "type": "issues", "count": len(issues)})
        else:
            lines.append("- no issues found")

        lines.append("\nCalendar:")
        if events:
            for row in events:
                starts_at = row["starts_at"].isoformat() if row["starts_at"] else "no date"
                lines.append(f"- {row['title']} | type={row['event_type']} | starts_at={starts_at}")
            sources.append({"title": "Calendar data", "type": "calendar", "count": len(events)})
        else:
            lines.append("- no calendar events found")

        return "\n".join(lines), sources
