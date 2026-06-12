"""Report business logic."""

from app.repositories.report_repository import ReportRepository


class ReportService:
    def __init__(self, repo: ReportRepository):
        self.repo = repo

    async def generate_report(
        self,
        period: str,
        project_id: str | None = None,
        start_date: str | None = None,
    ) -> dict:
        normalized_period = "monthly" if period == "monthly" else "weekly"
        if start_date:
            return await self.repo.generate(normalized_period, project_id=project_id, start_date=start_date)
        return await self.repo.generate(normalized_period, project_id=project_id)

    async def update_report(self, report_id: str, content: str) -> bool:
        return await self.repo.update(report_id, content)

    async def delete_report(self, report_id: str) -> bool:
        return await self.repo.delete(report_id)

    async def list_reports(self, project_id: str | None = None) -> list[dict]:
        return await self.repo.get_all(project_id=project_id)

    async def review_check(self, project_id: str | None = None) -> dict:
        return await self.repo.review_check(project_id=project_id)
