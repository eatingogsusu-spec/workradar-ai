"""UC-07 AI assistant endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.post("")
async def chat(message: dict):
    """Answer a user question with retrieved operational context."""
    # TODO: Call knowledge_service and ai.analysis_runner.
    # TODO: Persist chat messages.
    return {
        "answer": "",
        "sources": [],
        "suggested_questions": [],
    }

