"""Calendar business logic."""

from app.repositories.calendar_repository import CalendarRepository


class CalendarService:
    def __init__(self, repo: CalendarRepository):
        self.repo = repo

    async def list_events(self, project_id: str | None = None) -> list[dict]:
        return await self.repo.get_all(project_id=project_id)

    async def create_event(self, data: dict) -> dict:
        return await self.repo.create(data)

    async def create_events(self, data: dict, event_dates: list[str]) -> list[dict]:
        return await self.repo.create_many(data, event_dates)

    async def delete_event(self, event_id: str, project_id: str | None = None) -> bool:
        return await self.repo.delete(event_id, project_id=project_id)

    async def delete_absence_series(self, event_id: str, project_id: str) -> bool:
        return await self.repo.delete_absence_series(event_id, project_id)
