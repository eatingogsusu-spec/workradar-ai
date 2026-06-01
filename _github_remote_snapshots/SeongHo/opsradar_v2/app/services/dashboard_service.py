from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HandoffReport, Issue, Todo
from app.schemas.dashboard import DashboardSummary


class DashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def summary(self, project_id: UUID) -> DashboardSummary:
        todo_result = await self.db.execute(
            select(
                func.count(Todo.id).filter(Todo.approval_status == "approved"),
                func.count(Todo.id).filter(Todo.approval_status == "approved", Todo.status == "done"),
                func.count(Todo.id).filter(Todo.approval_status == "pending"),
            ).where(Todo.project_id == project_id)
        )
        total_todos, completed_todos, pending_ai_todos = todo_result.one()

        issue_result = await self.db.execute(
            select(
                func.count(Issue.id).filter(Issue.is_candidate.is_(False), Issue.status.in_(["open", "in_progress"])),
                func.count(Issue.id).filter(Issue.is_candidate.is_(True)),
            ).where(Issue.project_id == project_id)
        )
        unresolved_issues, candidate_issues = issue_result.one()

        handoff_result = await self.db.execute(
            select(HandoffReport.handoff_score)
            .where(HandoffReport.project_id == project_id)
            .order_by(HandoffReport.created_at.desc())
            .limit(1)
        )

        return DashboardSummary(
            project_id=project_id,
            total_todo_count=total_todos or 0,
            completed_todo_count=completed_todos or 0,
            pending_ai_todo_count=pending_ai_todos or 0,
            unresolved_issue_count=unresolved_issues or 0,
            candidate_issue_count=candidate_issues or 0,
            latest_handoff_score=handoff_result.scalar_one_or_none(),
        )
