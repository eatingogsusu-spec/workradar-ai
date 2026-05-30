from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WeeklyReportRead(BaseModel):
    id: UUID
    project_id: UUID
    created_by: UUID
    week_start: datetime
    week_end: datetime
    content: str
    progress_rate: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MonthlyReportRead(BaseModel):
    id: UUID
    project_id: UUID
    created_by: UUID
    month_start: datetime
    month_end: datetime
    content: str
    progress_rate: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HandoffReportRead(BaseModel):
    id: UUID
    project_id: UUID
    created_by: UUID
    title: str
    content: str
    handoff_score: int
    missing_items_json: list[dict]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
