"""Calendar persistence for the v4 OpsRadar schema."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class CalendarRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_all(self, project_id: str | None = None) -> list[dict]:
        filters = []
        params = {}
        if project_id:
            filters.append("ce.project_id = CAST(:project_id AS uuid)")
            params["project_id"] = project_id
        where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""

        result = await self.db.execute(
            text(
                f"""
                SELECT
                  ce.id::text AS id,
                  ce.title,
                  ce.starts_at::date::text AS event_date,
                  to_char(ce.starts_at, 'HH24:MI') AS event_time,
                  ce.event_type,
                  u.name AS person,
                  ce.source_type,
                  ce.approval_status,
                  ce.created_at
                FROM calendar_events ce
                LEFT JOIN project_members pm ON pm.id = ce.member_id
                LEFT JOIN users u ON u.id = pm.user_id
                {where_clause}
                ORDER BY ce.starts_at
                """
            ),
            params,
        )
        return [dict(row) for row in result.mappings().all()]

    async def find_duplicate(
        self,
        *,
        project_id: str,
        title: str,
        event_date: str,
        event_time: str,
        member_id: str | None,
    ) -> dict | None:
        result = await self.db.execute(
            text(
                """
                SELECT id::text AS id
                FROM calendar_events
                WHERE project_id = CAST(:project_id AS uuid)
                  AND lower(trim(title)) = lower(trim(:title))
                  AND starts_at = to_timestamp(
                    :event_date || ' ' || :event_time,
                    'YYYY-MM-DD HH24:MI'
                  )
                  AND member_id IS NOT DISTINCT FROM CAST(:member_id AS uuid)
                LIMIT 1
                """
            ),
            {
                "project_id": project_id,
                "title": title,
                "event_date": event_date,
                "event_time": event_time,
                "member_id": member_id,
            },
        )
        row = result.mappings().one_or_none()
        return dict(row) if row else None

    async def create(self, data: dict) -> dict:
        return (await self.create_many(data, [data["event_date"]]))[0]

    async def create_many(self, data: dict, event_dates: list[str]) -> list[dict]:
        events = []
        for event_date in event_dates:
            result = await self.db.execute(
                text(
                    """
                    INSERT INTO calendar_events (
                      id, project_id, event_type, title, source_type,
                      approval_status, member_id, starts_at, created_at
                    )
                    VALUES (
                      gen_random_uuid(),
                      COALESCE(
                        CAST(:project_id AS uuid),
                        (SELECT id FROM projects ORDER BY created_at LIMIT 1)
                      ),
                      :event_type,
                      :title,
                      :source_type,
                      'approved',
                      CAST(:member_id AS uuid),
                      to_timestamp(
                        :event_date || ' ' || :event_time,
                        'YYYY-MM-DD HH24:MI'
                      ),
                      now()
                    )
                    RETURNING
                      id::text AS id,
                      title,
                      starts_at::date::text AS event_date,
                      to_char(starts_at, 'HH24:MI') AS event_time,
                      event_type,
                      member_id::text AS member_id,
                      source_type
                    """
                ),
                {
                    "project_id": data.get("project_id"),
                    "event_type": data.get("event_type", "meeting"),
                    "title": data["title"],
                    "source_type": data.get("source_type") or "manual",
                    "event_date": event_date,
                    "event_time": data.get("event_time") or "00:00",
                    "member_id": data.get("member_id"),
                },
            )
            events.append(dict(result.mappings().one()))
        await self.db.commit()
        return events

    async def delete(self, event_id: str, project_id: str | None = None) -> bool:
        project_filter = "AND project_id = CAST(:project_id AS uuid)" if project_id else ""
        result = await self.db.execute(
            text(f"DELETE FROM calendar_events WHERE id = CAST(:event_id AS uuid) {project_filter}"),
            {"event_id": event_id, "project_id": project_id},
        )
        await self.db.commit()
        return result.rowcount > 0

    async def delete_absence_series(self, event_id: str, project_id: str) -> bool:
        result = await self.db.execute(
            text(
                """
                WITH target AS (
                  SELECT source_type
                  FROM calendar_events
                  WHERE id = CAST(:event_id AS uuid)
                    AND project_id = CAST(:project_id AS uuid)
                    AND source_type LIKE 'absence:%'
                )
                DELETE FROM calendar_events
                WHERE project_id = CAST(:project_id AS uuid)
                  AND source_type = (SELECT source_type FROM target)
                """
            ),
            {"event_id": event_id, "project_id": project_id},
        )
        await self.db.commit()
        return result.rowcount > 0
