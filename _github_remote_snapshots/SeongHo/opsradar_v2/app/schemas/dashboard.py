from uuid import UUID

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    project_id: UUID
    total_todo_count: int = 0
    completed_todo_count: int = 0
    delayed_todo_count: int = 0
    pending_ai_todo_count: int = 0
    unresolved_issue_count: int = 0
    candidate_issue_count: int = 0
    latest_handoff_score: int | None = None
