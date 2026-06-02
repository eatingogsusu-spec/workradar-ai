"""Report API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.report_repository import ReportRepository
from app.services.report_service import ReportService

router = APIRouter()


@router.post("/generate")
async def generate_report(body: dict | None = None, db: AsyncSession = Depends(get_db)):
    period = (body or {}).get("period", "weekly")
    week_start, week_end = _week_range()

    summary = (
        await db.execute(
            text(
                """
                SELECT
                  (SELECT count(*) FROM todos) AS total_todos,
                  (SELECT count(*) FROM todos WHERE status IN ('completed', 'done')) AS done_todos,
                  (SELECT count(*) FROM todos WHERE status IN ('pending', 'in_progress')) AS active_todos,
                  (SELECT count(*) FROM issues WHERE status <> 'resolved') AS open_issues,
                  (SELECT count(*) FROM issues WHERE status <> 'resolved' AND severity IN ('high', 'critical')) AS high_issues,
                  (SELECT count(*) FROM calendar_events WHERE starts_at::date >= current_date) AS upcoming_events
                """
            )
        )
    ).mappings().one()

    content = "\n".join(
        [
            "# 주간 운영 보고서 초안",
            f"기간: {week_start} ~ {week_end}",
            f"Todo 진행: 완료 {summary['done_todos']}건 / 전체 {summary['total_todos']}건",
            f"진행 중 또는 대기 Todo: {summary['active_todos']}건",
            f"미해결 이슈: {summary['open_issues']}건 / High Risk: {summary['high_issues']}건",
            f"다가오는 캘린더 일정: {summary['upcoming_events']}건",
            "다음 액션: 담당자 미지정 항목 확인, 마감 일정 점검, 인수인계 체크리스트 최신화",
        ]
    )

    result = await db.execute(
        text(
            """
            INSERT INTO weekly_reports (
              id, project_id, created_by_member_id, week_start, week_end,
              content, progress_rate, created_at
            )
            VALUES (
              gen_random_uuid(),
              (SELECT id FROM projects ORDER BY created_at LIMIT 1),
              (SELECT id FROM project_members ORDER BY id LIMIT 1),
              to_date(:week_start, 'YYYY-MM-DD'),
              to_date(:week_end, 'YYYY-MM-DD'),
              :content,
              CASE
                WHEN :total_todos = 0 THEN 0
                ELSE floor((CAST(:done_todos AS numeric) / CAST(:total_todos AS numeric)) * 100)::int
              END,
              now()
            )
            ON CONFLICT ON CONSTRAINT uq_weekly_reports_project_week
            DO UPDATE SET
              content = EXCLUDED.content,
              progress_rate = EXCLUDED.progress_rate,
              created_at = now()
            RETURNING id::text AS report_id
            """
        ),
        {
            "week_start": week_start,
            "week_end": week_end,
            "content": content,
            "done_todos": int(summary["done_todos"]),
            "total_todos": int(summary["total_todos"]),
        },
    )
    await db.commit()

    return {
        "report_id": result.scalar_one(),
        "period": period,
        "week_start": week_start,
        "week_end": week_end,
        "content": content,
    }



@router.patch("/{report_id}")
async def update_report(report_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    content = body.get("content")
    if content is None:
        raise HTTPException(400, "content is required")
    updated = await ReportService(ReportRepository(db)).update_report(report_id, content)
    if not updated:
        raise HTTPException(404, "report not found")
    return {"status": "success", "report_id": report_id}


@router.get("")
async def get_reports(db: AsyncSession = Depends(get_db)):
    reports = await ReportService(ReportRepository(db)).list_reports()
    return {"reports": reports}
