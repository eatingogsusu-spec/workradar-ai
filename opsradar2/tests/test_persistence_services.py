"""Focused service tests for persistence decisions."""

import asyncio
from datetime import datetime

from app.repositories.todo_repository import _normalize_due_at
from app.services.report_service import ReportService
from app.services.issue_service import IssueService
from app.services.todo_service import TodoService


class TodoRepoStub:
    def __init__(self):
        self.updated = None

    async def update(self, todo_id, data):
        self.updated = (todo_id, data)
        return True


class ReportRepoStub:
    def __init__(self):
        self.generated_period = None

    async def generate(self, period, project_id=None):
        self.generated_period = period
        return {"period": period}


class IssueRepoStub:
    def __init__(self, exists=True):
        self.issue_exists = exists

    async def exists(self, issue_id):
        return self.issue_exists


class LinkedTodoRepoStub:
    def __init__(self):
        self.created = None

    async def create(self, data):
        self.created = data
        return "todo-id"


def test_todo_service_forwards_update_fields():
    repo = TodoRepoStub()

    updated = asyncio.run(
        TodoService(repo).update_todo(
            "todo-id",
            {"title": "새 제목", "approval_status": "rejected"},
        )
    )

    assert updated is True
    assert repo.updated == (
        "todo-id",
        {"title": "새 제목", "approval_status": "rejected"},
    )


def test_report_service_normalizes_unknown_period_to_weekly():
    repo = ReportRepoStub()

    report = asyncio.run(ReportService(repo).generate_report("daily"))

    assert report == {"period": "weekly"}
    assert repo.generated_period == "weekly"


def test_report_service_preserves_monthly_period():
    repo = ReportRepoStub()

    report = asyncio.run(ReportService(repo).generate_report("monthly"))

    assert report == {"period": "monthly"}
    assert repo.generated_period == "monthly"


def test_issue_service_links_created_todo_to_existing_issue():
    todo_repo = LinkedTodoRepoStub()

    todo_id = asyncio.run(
        IssueService(IssueRepoStub(), todo_repo).create_todo_from_issue(
            "issue-id",
            {"title": "Follow up"},
        )
    )

    assert todo_id == "todo-id"
    assert todo_repo.created == {
        "title": "Follow up",
        "linked_issue_id": "issue-id",
        "source": "manual",
    }


def test_issue_service_does_not_create_todo_for_missing_issue():
    todo_repo = LinkedTodoRepoStub()

    todo_id = asyncio.run(
        IssueService(IssueRepoStub(exists=False), todo_repo).create_todo_from_issue(
            "missing-issue",
            {"title": "Follow up"},
        )
    )

    assert todo_id is None
    assert todo_repo.created is None


def test_todo_due_date_string_is_normalized_for_asyncpg():
    due_at = _normalize_due_at("2026-06-30")

    assert isinstance(due_at, datetime)
    assert due_at.isoformat() == "2026-06-30T00:00:00"


def test_empty_todo_due_date_is_normalized_to_none():
    assert _normalize_due_at("") is None
    assert _normalize_due_at(None) is None
