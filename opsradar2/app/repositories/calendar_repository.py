"""
Calendar DB 쿼리
담당: 박주원
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from app.models.calendar import CalendarEvent


class CalendarRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self) -> list[CalendarEvent]:
        result = await self.db.execute(
            select(CalendarEvent).order_by(CalendarEvent.event_date)
        )
        return result.scalars().all()

    async def get_by_date(self, date: str) -> list[CalendarEvent]:
        result = await self.db.execute(
            select(CalendarEvent).where(
                CalendarEvent.event_date == date
            )
        )
        return result.scalars().all()

    async def create(self, data: dict) -> CalendarEvent:
        event = CalendarEvent(**data)
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def delete(self, event: CalendarEvent) -> None:
        await self.db.delete(event)
        await self.db.commit()