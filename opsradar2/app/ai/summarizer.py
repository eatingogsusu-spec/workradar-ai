"""AI summarization/extraction helpers with deterministic fallback."""

from __future__ import annotations

import json
import re
from typing import Any

from app.ai.llm_client import AzureOpenAIConfigError, chat_completion
from app.core.config import settings


async def answer_question(query: str, context: str) -> dict:
    if not query.strip():
        raise ValueError("query is required")
    if settings.AI_PROVIDER.lower() != "azure":
        return {"answer": _fallback_answer(query, context), "sources": []}

    prompt = f"""
아래 업무 문서 context를 바탕으로 질문에 한국어로 답하세요.
문서에 없는 내용은 추측하지 말고, 해당 내용을 찾을 수 없다고 말하세요.

[context]
{context or "관련 문서 없음"}

[question]
{query}
"""
    try:
        answer = await chat_completion(prompt, system_prompt="You are OpsRadar's RAG assistant.", temperature=0.1)
        return {"answer": answer, "sources": []}
    except Exception:
        return {"answer": _fallback_answer(query, context), "sources": []}


async def summarize_document(document_text: str) -> dict:
    text = document_text.strip()
    if not text:
        return {"summary": "", "keywords": []}
    if settings.AI_PROVIDER.lower() != "azure":
        return {"summary": _simple_summary(text), "keywords": _simple_keywords(text)}

    prompt = (
        "다음 문서를 3줄 이내로 요약하고 핵심 키워드 5개를 JSON으로만 반환하세요.\n"
        '형식: {"summary":"", "keywords":[""]}\n\n'
        f"{text[:10000]}"
    )
    try:
        raw = await chat_completion(prompt, system_prompt="Return only valid JSON.", temperature=0.1)
        return _parse_json(raw, {"summary": _simple_summary(text), "keywords": _simple_keywords(text)})
    except Exception:
        return {"summary": _simple_summary(text), "keywords": _simple_keywords(text)}


async def extract_todos(document_text: str) -> dict:
    text = document_text.strip()
    if not text:
        return {"todos": [], "decisions": [], "issues": []}
    if settings.AI_PROVIDER.lower() != "azure":
        return _heuristic_extract(text)

    prompt = f"""
다음 문서에서 todos, decisions, issues를 JSON으로만 추출하세요.
문장 그대로 복사하기보다 업무 항목으로 정리하세요.

형식:
{{
  "todos": [{{"content": "", "assignee": null, "due_date": null}}],
  "decisions": [""],
  "issues": [{{"title": "", "description": "", "severity": "medium"}}]
}}

[문서]
{text[:10000]}
"""
    try:
        raw = await chat_completion(prompt, system_prompt="Return only valid JSON.", temperature=0.1)
        parsed = _parse_json(raw, _heuristic_extract(text))
        return _normalize_extraction(parsed)
    except Exception:
        return _heuristic_extract(text)


def _parse_json(raw: str, fallback: dict) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return fallback
    return parsed if isinstance(parsed, dict) else fallback


def _normalize_extraction(data: dict[str, Any]) -> dict:
    todos = data.get("todos") if isinstance(data.get("todos"), list) else []
    decisions = data.get("decisions") if isinstance(data.get("decisions"), list) else []
    issues = data.get("issues") if isinstance(data.get("issues"), list) else []

    normalized_todos = []
    for item in todos[:20]:
        if isinstance(item, str):
            normalized_todos.append({"content": item, "assignee": None, "due_date": None})
        elif isinstance(item, dict):
            content = item.get("content") or item.get("title")
            if content:
                normalized_todos.append(
                    {
                        "content": str(content),
                        "assignee": item.get("assignee"),
                        "due_date": item.get("due_date") or item.get("due_at"),
                    }
                )

    normalized_issues = []
    for item in issues[:20]:
        if isinstance(item, str):
            normalized_issues.append({"title": item, "description": item, "severity": "medium"})
        elif isinstance(item, dict):
            title = item.get("title") or item.get("description")
            if title:
                normalized_issues.append(
                    {
                        "title": str(title),
                        "description": item.get("description") or str(title),
                        "severity": item.get("severity") or "medium",
                    }
                )

    return {
        "todos": normalized_todos,
        "decisions": [str(item) for item in decisions[:20]],
        "issues": normalized_issues,
    }


def _simple_summary(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    selected = [sentence.strip() for sentence in sentences if sentence.strip()][:3]
    return " ".join(selected)[:700]


def _simple_keywords(text: str) -> list[str]:
    words = re.findall(r"[A-Za-z가-힣0-9]{3,}", text)
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return [word for word, _ in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:5]]


def _heuristic_extract(text: str) -> dict:
    lines = [line.strip() for line in re.split(r"\n+|(?<=[.!?])\s+", text) if line.strip()]
    todos = []
    decisions = []
    issues = []
    for line in lines:
        if any(token in line for token in ("해야", "필요", "완료", "담당", "마감", "TODO", "todo")):
            todos.append({"content": line[:300], "assignee": None, "due_date": None})
        if any(token in line for token in ("결정", "확정", "합의")):
            decisions.append(line[:300])
        if any(token in line for token in ("이슈", "문제", "blocked", "Blocked", "리스크", "주의 필요")):
            issues.append({"title": line[:160], "description": line[:300], "severity": "medium"})
    return {"todos": todos[:20], "decisions": decisions[:20], "issues": issues[:20]}


def _fallback_answer(query: str, context: str) -> str:
    if context.strip():
        return f"업로드된 문서 기준으로 확인했습니다.\n\n{_simple_summary(context)}"
    return "관련 문서를 찾지 못했습니다. 먼저 회의록, 보고서, 인수인계 문서를 업로드해 주세요."
