"""Issue business logic."""

from typing import Optional

from app.repositories.issue_repository import IssueRepository
from app.repositories.todo_repository import TodoRepository


class IssueService:
    def __init__(self, repo: IssueRepository, todo_repo: TodoRepository | None = None):
        self.repo = repo
        self.todo_repo = todo_repo

    async def create_issue(self, data: dict) -> dict:
        return await self.repo.create(data)

    async def list_issues(
        self,
        status: Optional[str] = None,
        risk_level: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> list[dict]:
        return await self.repo.get_all(status=status, risk_level=risk_level, project_id=project_id)

    async def update_issue(self, issue_id: str, data: dict) -> bool:
        return await self.repo.update(issue_id, data)

    async def resolve_issue(self, issue_id: str) -> bool:
        return await self.repo.resolve(issue_id)

    async def delete_issue(self, issue_id: str) -> bool:
        return await self.repo.delete(issue_id)

    async def create_todo_from_issue(self, issue_id: str, data: dict) -> str | None:
        if self.todo_repo is None:
            raise RuntimeError("Todo repository is required")
        if not await self.repo.exists(issue_id):
            return None
        return await self.todo_repo.create(
            {
                **data,
                "linked_issue_id": issue_id,
                "source": data.get("source", "manual"),
            }
        )
