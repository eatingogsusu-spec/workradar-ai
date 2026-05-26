"""
Calendar API
담당: 박주원
"""
import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.repositories.calendar_repository import CalendarRepository
from app.schemas.calendar import CalendarEventCreate

router = APIRouter()


@router.get("/")
async def get_events(db: AsyncSession = Depends(get_db)):
    repo = CalendarRepository(db)
    events = await repo.get_all()
    return {"events": [
        {
            "id": e.id,
            "title": e.title,
            "event_date": e.event_date,
            "event_type": e.event_type,
            "person": e.person,
            "description": e.description,
        } for e in events
    ]}


@router.post("/")
async def create_event(
    body: CalendarEventCreate,
    db: AsyncSession = Depends(get_db)
):
    repo = CalendarRepository(db)
    event = await repo.create({
        "id": str(uuid.uuid4()),
        "title": body.title,
        "event_date": body.event_date,
        "event_type": body.event_type,
        "person": body.person,
        "description": body.description,
    })
    return {"event": {
        "id": event.id,
        "title": event.title,
        "event_date": event.event_date,
        "event_type": event.event_type,
        "person": event.person,
    }}


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    db: AsyncSession = Depends(get_db)
):
    repo = CalendarRepository(db)
    events = await repo.get_all()
    event = next((e for e in events if e.id == event_id), None)
    if not event:
        from fastapi import HTTPException
        raise HTTPException(404, "이벤트를 찾을 수 없어요")
    await repo.delete(event)
    return {"message": "삭제 완료"}