from pydantic import BaseModel
from typing import List


class RecentActivity(BaseModel):
    type: str
    title: str
    created_at: str


class DashboardSummary(BaseModel):
    high_risk_count: int
    todo_total: int
    todo_completed: int
    todo_pending: int
    blocked_count: int
    ai_summary: str
    recent_activities: List[RecentActivity]
