"""UC-06 onboarding and handover knowledge endpoints."""

from __future__ import annotations

import uuid as uuid_module

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.handover_repository import gather_handover_input
from app.services.handover_draft_service import HandoverDraftService

router = APIRouter()


class GenerateHandoverRequest(BaseModel):
    owner: str = ""
    receiver: str = ""
    target: str = ""
    mentor: str = ""
    type: str = "handoff"
    todo_ids: list[str] = []
    issue_ids: list[str] = []
    department: str | None = None
    period: str | None = None


@router.get("/onboarding")
async def get_onboarding():
    """Generate onboarding knowledge for a new team member."""
    # TODO: Generate via knowledge_service and ai.analysis_runner.
    return {
        "project_overview": "",
        "current_status": "",
        "recent_decisions": [],
        "key_risks": [],
        "reference_documents": [],
    }


@router.get("/handover")
async def get_handover():
    """Generate a handover summary."""
    # TODO: Generate via knowledge_service and ai.analysis_runner.
    return {
        "in_progress_tasks": [],
        "priority_todos": [],
        "blocked_items": [],
        "recent_changes": [],
        "reference_documents": [],
    }


@router.post("/generate-handover")
async def generate_handover(
    body: GenerateHandoverRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate an AI handover document from selected todos and issues."""
    # Resolve default project (same pattern as report_repository._default_project_id)
    proj_result = await db.execute(
        text("SELECT id::text FROM projects ORDER BY created_at LIMIT 1")
    )
    project_id = proj_result.scalar_one_or_none()
    if not project_id:
        return {"content": None, "generation_mode": "fallback"}

    # Step 1: assemble grounding data from selected IDs
    handover_input = await gather_handover_input(
        db,
        project_id=project_id,
        owner=body.owner,
        receiver=body.receiver,
        todo_ids=body.todo_ids,
        issue_ids=body.issue_ids,
    )
    # The same grounded dataset powers both documents. Onboarding adds the
    # learner and mentor context without introducing a new persistence model.
    handover_input.update(
        {
            "target": body.target,
            "mentor": body.mentor,
            "department": body.department,
            "period": body.period,
        }
    )

    # Step 2: LLM generation
    document_type = "onboarding" if body.type == "onboarding" else "handoff"
    content = await HandoverDraftService().generate(
        handover_input,
        document_type=document_type,
    )

    if not content:
        return {"content": None, "generation_mode": "fallback"}

    # Step 3: persist to handoff_reports
    await db.execute(
        text("""
            INSERT INTO handoff_reports (id, project_id, handoff_type, content)
            VALUES (CAST(:id AS uuid), CAST(:project_id AS uuid), :handoff_type, :content)
        """),
        {
            "id": str(uuid_module.uuid4()),
            "project_id": project_id,
            "handoff_type": body.type or "handoff",
            "content": content,
        },
    )
    await db.commit()

    docs = [
        {"doc_id": d["doc_id"], "title": d["title"]}
        for d in handover_input.get("documents", [])
    ]
    return {"content": content, "generation_mode": "ai", "documents": docs}
