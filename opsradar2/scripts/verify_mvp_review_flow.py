"""Verify the MVP review flow through the running HTTP API.

Flow covered:
- create Todo candidate
- mark as needs_revision
- approve as official work
- create high-risk Issue candidate
- mark Issue as needs_revision and approve
- verify Dashboard and Report review-check contracts

The script removes its own test Todo/Issue rows before and after running.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.database import AsyncSessionLocal, engine


API_BASE = os.getenv("OPSRADAR_API_BASE", "http://127.0.0.1:8002/api/v1").rstrip("/")
HEALTH_URL = os.getenv("OPSRADAR_HEALTH_URL", "http://127.0.0.1:8002/health")
CHECK_PREFIX = "__opsradar_mvp_review_flow__"


def request(method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = Request(
        f"{API_BASE}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(req, timeout=20) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise AssertionError(f"{method} {path} failed: {error.code} {detail}") from error


def health_check() -> None:
    with urlopen(HEALTH_URL, timeout=10) as res:
        assert res.status == 200, f"health returned {res.status}"


async def cleanup() -> None:
    async with AsyncSessionLocal() as session:
        await session.rollback()
        await session.execute(text("DELETE FROM todos WHERE title LIKE :prefix"), {"prefix": f"{CHECK_PREFIX}%"})
        await session.execute(text("DELETE FROM issues WHERE title LIKE :prefix"), {"prefix": f"{CHECK_PREFIX}%"})
        await session.commit()


def find_by_title(items: list[dict[str, Any]], title: str) -> dict[str, Any]:
    for item in items:
        if item.get("title") == title:
            return item
    raise AssertionError(f"item not found: {title}")


def assert_review_contract(item: dict[str, Any], expected_status: str) -> None:
    assert "evidence" in item, "missing evidence contract"
    assert "review" in item, "missing review contract"
    review = item["review"]
    assert review["approval_status"] == expected_status, review
    for key in ("has_evidence", "missing_evidence", "missing_assignee", "missing_due_date"):
        assert key in review, f"missing review.{key}"


def verify_todo_flow() -> str:
    title = f"{CHECK_PREFIX} todo"
    created = request(
        "POST",
        "/todos",
        {
            "title": title,
            "source": "manual",
            "status": "pending",
            "approval_status": "pending",
            "priority": "high",
        },
    )
    todo_id = created["todo_id"]
    todo = find_by_title(request("GET", "/todos")["todos"], title)
    assert todo["id"] == todo_id
    assert_review_contract(todo, "pending")

    request("PATCH", f"/todos/{todo_id}", {"approval_status": "needs_revision"})
    todo = find_by_title(request("GET", "/todos")["todos"], title)
    assert_review_contract(todo, "needs_revision")

    request("PATCH", f"/todos/{todo_id}", {"approval_status": "approved", "status": "in_progress"})
    todo = find_by_title(request("GET", "/todos")["todos"], title)
    assert_review_contract(todo, "approved")
    assert todo["status"] == "in_progress", todo
    return todo_id


def verify_issue_flow() -> str:
    title = f"{CHECK_PREFIX} issue"
    created = request(
        "POST",
        "/issues",
        {
            "title": title,
            "description": "MVP review flow high risk issue",
            "severity": "high",
            "status": "open",
        },
    )
    issue_id = created["id"]

    request("PATCH", f"/issues/{issue_id}", {"approval_status": "pending"})
    issue = find_by_title(request("GET", "/issues")["issues"], title)
    assert_review_contract(issue, "pending")
    assert issue["severity"] == "high", issue

    request("PATCH", f"/issues/{issue_id}", {"approval_status": "needs_revision"})
    issue = find_by_title(request("GET", "/issues")["issues"], title)
    assert_review_contract(issue, "needs_revision")

    request("PATCH", f"/issues/{issue_id}", {"approval_status": "approved"})
    issue = find_by_title(request("GET", "/issues")["issues"], title)
    assert_review_contract(issue, "approved")
    return issue_id


def verify_dashboard_and_report_contracts() -> None:
    dashboard = request("GET", "/dashboard/summary")
    for key in (
        "pending_review_count",
        "missing_evidence_count",
        "missing_assignee_count",
        "missing_due_date_count",
        "high_risk_count",
    ):
        assert key in dashboard, f"dashboard missing {key}"

    review_check = request("GET", "/reports/review-check")
    for key in (
        "with_evidence",
        "missing_evidence",
        "missing_assignee",
        "missing_due_date",
        "possible_conflicts",
    ):
        assert key in review_check, f"report review-check missing {key}"


async def main() -> None:
    await cleanup()
    try:
        health_check()
        todo_id = verify_todo_flow()
        issue_id = verify_issue_flow()
        verify_dashboard_and_report_contracts()
        print(f"health=ok base={API_BASE}")
        print(f"todo_review_flow=ok id={todo_id}")
        print(f"issue_review_flow=ok id={issue_id}")
        print("dashboard_contract=ok")
        print("report_review_check_contract=ok")
    finally:
        await cleanup()
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
