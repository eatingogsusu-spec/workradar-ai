"""AI summarization/extraction helpers - async version for opsradar2."""

from __future__ import annotations

import json
import re
from typing import Any

from app.ai.llm_client import AzureOpenAIConfigError, chat_completion
from app.core.config import settings


async def answer_question(query: str, context: str) -> dict:
    """답변 생성 - LLM 사용"""
    if not query.strip():
        raise ValueError("query is required")

    # 디버그 로깅
    print(f"\n{'='*70}")
    print(f"[DEBUG] Query: {query}")
    print(f"[DEBUG] Context length: {len(context)} chars")
    
    # Issues 섹션 추출
    if "Issues:" in context:
        issues_idx = context.find("Issues:")
        calendar_idx = context.find("Calendar:") if "Calendar:" in context else len(context)
        issues_section = context[issues_idx:calendar_idx]
        print(f"[DEBUG] Issues section found ({len(issues_section)} chars):")
        print(issues_section[:500])
    print(f"{'='*70}\n")

    prompt = f"""당신은 OpsRadar 운영 데이터 분석 AI입니다.
아래 데이터를 기반으로 사용자 질문에 정확하게 답하세요.

[OpsRadar 운영 데이터]
{context or "데이터 없음"}

[사용자 질문]
{query}

[답변 규칙 - 반드시 따르세요]
1. 반드시 Issues:, Todos:, Calendar: 섹션의 실제 항목 데이터를 읽으세요
2. AI summary는 참고용일 뿐입니다. 실제 데이터 항목을 우선하세요
3. 질문에서 필터 조건(담당자, 날짜, 상태, 우선순위)을 정확히 파악하세요
4. assignee=담당자 미지정 인 항목이 "담당자 미지정" 이슈입니다
5. created=YYYY-MM-DD 형식으로 날짜를 비교하세요
6. 조건에 정확히 맞는 항목만 나열하세요
7. 조건에 맞는 항목이 없으면 "해당 조건에 맞는 항목을 찾지 못했습니다"라고 하세요
8. 반드시 한국어로 답변하세요
9. 각 항목의 제목, 상태, 담당자, 날짜 등 중요 정보를 명확하게 포함하세요

[답변 예시]
질문: "담당자 미지정 이슈는?"
답변:
- 수동 등록 Issue도 함께 생성한다. | status=open | assignee=담당자 미지정 | severity=medium
- 업로드 상태 표시가 누락될 수 있음 | status=open | assignee=담당자 미지정 | severity=medium

질문: "5월 14일 이슈는?"
답변:
- Azure OpenAI API 타임아웃 이슈 | created=2026-05-14 | severity=high | assignee=이성우
- RAG 검색 정확도 Blocked | created=2026-05-14 | severity=medium | assignee=김성호
"""
    try:
        answer = await chat_completion(
            prompt,
            system_prompt="You are OpsRadar's operational data analyst. ALWAYS answer in Korean. ONLY use data from Issues:, Todos:, Calendar: sections. Ignore AI summary. Be precise and list actual items with their attributes.",
            temperature=0.1,
        )
        print(f"[DEBUG] LLM Answer:\n{answer}\n")
        return {"answer": answer, "sources": []}
    except Exception as e:
        print(f"[DEBUG] Exception in answer_question: {type(e).__name__}: {e}\n")
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
        return f"운영 데이터 분석 결과:\n{_simple_summary(context)}"
    return "관련 데이터를 찾지 못했습니다."
