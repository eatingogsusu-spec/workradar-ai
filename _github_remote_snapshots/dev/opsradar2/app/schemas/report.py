from pydantic import BaseModel
from typing import Optional


class ReportGenerateRequest(BaseModel):
    period: str           # daily | weekly | monthly
    start_date: str
    end_date: str


class ReportUpdate(BaseModel):
    content: str


class ReportResponse(BaseModel):
    report_id: str
    period: str
    content: str
    created_at: str
