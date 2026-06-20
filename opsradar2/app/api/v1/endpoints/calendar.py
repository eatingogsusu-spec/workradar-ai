"""Authenticated calendar API for manual operational schedules."""

from datetime import date, timedelta
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.repositories.calendar_repository import CalendarRepository
from app.services.calendar_service import CalendarService

router = APIRouter()
VALID_EVENT_TYPES = {"deadline", "absence", "meeting", "milestone"}


def normalized_title(value: object) -> str:
    return " ".join(str(value or "").split())


def normalized_time(value: object) -> str:
    raw = str(value or "00:00").strip()
    try:
        hour, minute = raw.split(":", 1)
        hour_value, minute_value = int(hour), int(minute)
    except (TypeError, ValueError):
        raise HTTPException(422, "event_time must use HH:MM format")
    if not 0 <= hour_value <= 23 or not 0 <= minute_value <= 59:
        raise HTTPException(422, "event_time must be a valid time")
    return f"{hour_value:02d}:{minute_value:02d}"


def required_uuid(value: object, field: str) -> str:
    try:
        return str(UUID(str(value)))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(422, f"{field} must be a valid UUID")


async def ensure_active_member(
    db: AsyncSession,
    *,
    member_id: str,
    project_id: str,
) -> None:
    result = await db.execute(
        text(
            """
            SELECT 1
            FROM project_members
            WHERE id = CAST(:member_id AS uuid)
              AND project_id = CAST(:project_id AS uuid)
              AND status = 'active'
            """
        ),
        {"member_id": member_id, "project_id": project_id},
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(422, "assignee must be an active member of this project")


async def create_calendar_events(
    body: dict,
    *,
    project_id: str,
    db: AsyncSession,
) -> list[dict]:
    title = normalized_title(body.get("title"))
    if not title or not body.get("event_date"):
        raise HTTPException(400, "title and event_date are required")
    if len(title) > 120:
        raise HTTPException(422, "title must be 120 characters or fewer")
    try:
        start_date = date.fromisoformat(str(body["event_date"]))
        end_date = date.fromisoformat(str(body.get("end_date") or body["event_date"]))
    except (TypeError, ValueError):
        raise HTTPException(422, "event_date and end_date must use YYYY-MM-DD format")
    if end_date < start_date:
        raise HTTPException(422, "end_date must not be earlier than event_date")

    event_type = str(body.get("event_type") or "meeting").strip().lower()
    if event_type not in VALID_EVENT_TYPES:
        raise HTTPException(422, "event_type is invalid")
    if event_type != "absence" and end_date != start_date:
        raise HTTPException(422, "only absence events can span multiple days")
    if (end_date - start_date).days > 31:
        raise HTTPException(422, "absence events can span up to 32 calendar days")

    member_id = body.get("member_id")
    if member_id:
        member_id = required_uuid(member_id, "member_id")
        await ensure_active_member(db, member_id=member_id, project_id=project_id)
    if event_type == "absence" and not member_id:
        raise HTTPException(422, "absence events require an assigned member")

    event_time = normalized_time(body.get("event_time"))
    event_dates = [
        (start_date + timedelta(days=offset)).isoformat()
        for offset in range((end_date - start_date).days + 1)
    ]
    service = CalendarService(CalendarRepository(db))
    for event_date in event_dates:
        duplicate = await service.repo.find_duplicate(
            project_id=project_id,
            title=title,
            event_date=event_date,
            event_time=event_time,
            member_id=member_id,
        )
        if duplicate:
            raise HTTPException(409, "an identical calendar event already exists")

    source_type = "manual"
    if event_type == "absence" and len(event_dates) > 1:
        source_type = f"absence:{uuid4()}"
    return await service.create_events(
        {
            "project_id": project_id,
            "title": title,
            "event_time": event_time,
            "event_type": event_type,
            "member_id": member_id,
            "source_type": source_type,
        },
        event_dates,
    )


@router.get("")
@router.get("/")
async def get_events(
    project_id: Optional[str] = None,
    actor: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    actor_project_id = actor["project_id"]
    if project_id and project_id != actor_project_id:
        raise HTTPException(403, "project access denied")
    service = CalendarService(CalendarRepository(db))
    return {"events": await service.list_events(project_id=actor_project_id)}


@router.post("/")
async def create_event(
    body: dict,
    actor: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    events = await create_calendar_events(body, project_id=actor["project_id"], db=db)
    return {"event": events[0], "events": events}


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    series: bool = False,
    actor: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    event_id = required_uuid(event_id, "event_id")
    service = CalendarService(CalendarRepository(db))
    deleted = (
        await service.delete_absence_series(event_id, project_id=actor["project_id"])
        if series
        else await service.delete_event(event_id, project_id=actor["project_id"])
    )
    if not deleted:
        raise HTTPException(404, "event not found")
    return {"message": "deleted"}
