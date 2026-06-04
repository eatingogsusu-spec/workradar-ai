"""UC-07 AI assistant endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_client import AzureOpenAIConfigError
from app.ai.retriever import build_context, retrieve
from app.ai.summarizer import answer_question, extract_todos
from app.core.config import settings
from app.core.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.assistant_context_service import AssistantContextService

router = APIRouter()


class ExtractRequest(BaseModel):
    text: str = Field(min_length=1)


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Answer with current OpsRadar data, plus document RAG when available."""
    operational_context, operational_sources = await AssistantContextService(db).build_context()

    rag_context = ""
    rag_sources: list[dict] = []
    try:
        results = await retrieve(payload.message, top_k=3)
        rag_context = build_context(results)
        rag_sources = [
            {
                "title": result.get("source") or result.get("file_name"),
                "score": result.get("score"),
                "document_id": result.get("document_id"),
                "type": "document",
            }
            for result in results
        ]
    except (FileNotFoundError, AzureOpenAIConfigError, ModuleNotFoundError, RuntimeError, ValueError):
        rag_context = ""

    context = "\n\n".join(part for part in [rag_context, operational_context] if part.strip())
    if _is_operational_question(payload.message) or settings.AI_PROVIDER.lower() != "azure":
        answer = _local_answer(payload.message, operational_context)
    else:
        try:
            answer_result = await answer_question(payload.message, context)
            answer = answer_result.get("answer", "")
        except Exception:
            answer = _local_answer(payload.message, operational_context)

        if not answer.strip() or "AI_PROVIDER=azure" in answer:
            answer = _local_answer(payload.message, operational_context)

    return ChatResponse(
        answer=answer,
        sources=rag_sources + operational_sources,
        suggested_questions=[
            "현재 위험한 이슈가 뭐야?",
            "미완료 Todo 알려줘",
            "다가오는 일정 알려줘",
        ],
    )


@router.post("/extract")
async def extract_from_text(payload: ExtractRequest):
    result = await extract_todos(payload.text)
    return {
        "todos": result.get("todos", []),
        "decisions": result.get("decisions", []),
        "issues": result.get("issues", []),
        "counts": {
            "todos": len(result.get("todos", [])),
            "decisions": len(result.get("decisions", [])),
            "issues": len(result.get("issues", [])),
        },
    }


def _is_operational_question(message: str) -> bool:
    lowered = message.lower()
    tokens = (
        "todo",
        "issue",
        "calendar",
        "할 일",
        "미완료",
        "이슈",
        "위험",
        "리스크",
        "일정",
        "캘린더",
    )
    return any(token in lowered or token in message for token in tokens)


def _local_answer(message: str, context: str) -> str:
    lowered = message.lower()
    sections = _split_context(context)
    if "todo" in lowered or "할 일" in message or "미완료" in message:
        return "현재 Todo 기준으로 보면:\n" + "\n".join(sections.get("Todos", ["- no todos found"])[:8])
    if "issue" in lowered or "이슈" in message or "위험" in message or "리스크" in message:
        return "현재 Issue 기준으로 보면:\n" + "\n".join(sections.get("Issues", ["- no issues found"])[:8])
    if "calendar" in lowered or "일정" in message or "캘린더" in message:
        return "현재 Calendar 기준으로 보면:\n" + "\n".join(sections.get("Calendar", ["- no calendar events found"])[:8])

    combined = (
        ["현재 OpsRadar 데이터 기준 요약:"]
        + sections.get("Todos", [])[:3]
        + sections.get("Issues", [])[:3]
        + sections.get("Calendar", [])[:3]
    )
    return "\n".join(combined).strip()


def _split_context(context: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current = ""
    for line in context.splitlines():
        stripped = line.strip()
        if stripped in {"Todos:", "Issues:", "Calendar:"}:
            current = stripped[:-1]
            sections[current] = []
        elif current and stripped.startswith("-"):
            sections[current].append(stripped)
    return sections
