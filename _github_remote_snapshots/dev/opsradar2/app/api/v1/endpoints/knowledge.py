"""UC-06 onboarding and handover knowledge endpoints."""

from fastapi import APIRouter

router = APIRouter()


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

