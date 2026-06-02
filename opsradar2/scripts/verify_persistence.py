"""Exercise shared database persistence paths without leaving test Todo or calendar rows."""

from __future__ import annotations

import asyncio
import sys
from datetime import date
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.database import AsyncSessionLocal, engine
from app.repositories.calendar_repository import CalendarRepository
from app.repositories.issue_repository import IssueRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.todo_repository import TodoRepository
from app.services.issue_service import IssueService


CHECK_TITLE = "__opsradar_persistence_check__"


async def main() -> None:
    async with AsyncSessionLocal() as session:
        todo_repo = TodoRepository(session)
        calendar_repo = CalendarRepository(session)
        issue_repo = IssueRepository(session)
        report_repo = ReportRepository(session)
        report = None
        weekly_snapshot = await _snapshot_current_weekly_report(session)

        await _cleanup(session)
        try:
            todo_id = await todo_repo.create({"title": CHECK_TITLE, "source": "manual"})
            todos = await todo_repo.get_all()
            assert any(todo["id"] == todo_id for todo in todos)

            calendar = await calendar_repo.create(
                {
                    "title": CHECK_TITLE,
                    "event_date": date.today().isoformat(),
                    "event_type": "meeting",
                }
            )
            events = await calendar_repo.get_all()
            assert any(event["id"] == calendar["id"] for event in events)

            issue = await issue_repo.create({"title": CHECK_TITLE, "severity": "high"})
            issues = await issue_repo.get_all()
            assert any(item["id"] == issue["id"] for item in issues)

            linked_todo_id = await IssueService(issue_repo, todo_repo).create_todo_from_issue(
                issue["id"],
                {"title": CHECK_TITLE, "priority": "high"},
            )
            assert linked_todo_id

            report = await report_repo.generate("weekly")
            reports = await report_repo.get_all()
            assert any(item["id"] == report["report_id"] for item in reports)
        finally:
            await _cleanup(session)
            if report:
                await _restore_weekly_report(session, weekly_snapshot, report["report_id"])

    await engine.dispose()
    print("todo=create/read/delete ok")
    print("calendar=create/read/delete ok")
    print("issue=create/read/delete ok")
    print("issue_todo=create/delete ok")
    print(f"weekly_report=generate/read ok id={report['report_id']}")


async def _cleanup(session) -> None:
    await session.rollback()
    await session.execute(text("DELETE FROM todos WHERE title = :title"), {"title": CHECK_TITLE})
    await session.execute(text("DELETE FROM calendar_events WHERE title = :title"), {"title": CHECK_TITLE})
    await session.execute(text("DELETE FROM issues WHERE title = :title"), {"title": CHECK_TITLE})
    await session.commit()


async def _snapshot_current_weekly_report(session) -> dict | None:
    week_start, _ = ReportRepository._period_range("weekly")
    result = await session.execute(
        text(
            """
            SELECT id::text AS id, content, progress_rate, created_at
            FROM weekly_reports
            WHERE project_id = (SELECT id FROM projects ORDER BY created_at LIMIT 1)
              AND week_start = CAST(:week_start AS date)
            """
        ),
        {"week_start": week_start},
    )
    row = result.mappings().one_or_none()
    return dict(row) if row else None


async def _restore_weekly_report(session, snapshot: dict | None, report_id: str) -> None:
    if snapshot is None:
        await session.execute(
            text("DELETE FROM weekly_reports WHERE id = CAST(:report_id AS uuid)"),
            {"report_id": report_id},
        )
    else:
        await session.execute(
            text(
                """
                UPDATE weekly_reports
                SET content = :content,
                    progress_rate = :progress_rate,
                    created_at = :created_at
                WHERE id = CAST(:report_id AS uuid)
                """
            ),
            {"report_id": report_id, **snapshot},
        )
    await session.commit()


if __name__ == "__main__":
    asyncio.run(main())
