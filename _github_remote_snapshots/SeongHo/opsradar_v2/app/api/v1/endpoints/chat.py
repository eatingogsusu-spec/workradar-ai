from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse


router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return ChatResponse(
        answer=f"AI assistant pipeline is ready to answer for project {request.project_id}.",
        sources=[],
    )
