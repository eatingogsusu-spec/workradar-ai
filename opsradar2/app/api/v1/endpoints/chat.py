"""UC-07 AI assistant endpoints."""

from fastapi import APIRouter, HTTPException

from app.ai.llm_client import AzureOpenAIConfigError, chat_completion
from app.schemas.chat import ChatRequest, ChatResponse

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest):
    """Answer a user question with retrieved operational context."""
    system_prompt = (
        "You are OpsRadar's operations assistant. Answer in Korean. "
        "Be concise, practical, and clearly separate facts from assumptions."
    )
    try:
        answer = await chat_completion(payload.message, system_prompt=system_prompt)
    except AzureOpenAIConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Azure OpenAI request failed") from exc

    return ChatResponse(
        answer=answer,
        sources=[],
        suggested_questions=[],
    )

