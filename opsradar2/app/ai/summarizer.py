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
아래 운영 데이터와 RAG 문서를 종합해서 사용자 질문에 정확하고 도움이 되게 답하세요.

[OpsRadar 운영 데이터]
{context or "데이터 없음"}

[사용자 질문]
{query}

[답변 규칙]
1. 사람 이름이 질문에 포함되면 → RAG 문서(회의록, 채팅, 보고서)에서 그 사람이 언급된 내용을 모두 찾아 요약하세요
2. "업무 알려줘" = 그 사람이 담당하거나 언급된 Todo, Issue, 회의 내용을 모두 포함하세요
3. Todo/Issue 데이터는 실제 항목을 나열하세요 (요약 금지)
4. 데이터가 없는 섹션은 "해당 데이터 없음"으로 표시
5. 반드시 한국어로 답변
6. 아래 형식을 따르세요

---
## 👤 [이름] 업무 현황

### 📋 담당 Todo
- [항목명] (상태: X, 우선순위: X)

### 🚨 관련 이슈
- [항목명] (심각도: X, 상태: X)

### 📝 회의/문서에서 언급된 내용
- [요약]

### 💡 종합 의견
[한두 줄로 현재 상태 평가]
---
"""
    try:
        answer = await chat_completion(
            prompt,
            system_prompt="당신은 OpsRadar 운영 데이터 분석 AI입니다. 반드시 한국어로 답변하세요. RAG 문서와 운영 데이터를 종합해서 구체적이고 실용적인 답변을 제공하세요.",
            temperature=0.3,
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
이미 완료/해결/반영된 과거 작업은 todos 또는 issues에 포함하지 마세요. 완료 여부를 확인해야 하는 후속 작업만 포함하세요.

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
        if isinstance(item, str) and not _is_completed_statement(item):
            normalized_todos.append({"content": item, "assignee": None, "due_date": None})
        elif isinstance(item, dict):
            content = item.get("content") or item.get("title")
            if content and not _is_completed_statement(str(content)):
                normalized_todos.append(
                    {
                        "content": str(content),
                        "assignee": item.get("assignee"),
                        "due_date": item.get("due_date") or item.get("due_at"),
                    }
                )

    normalized_issues = []
    for item in issues[:20]:
        if isinstance(item, str) and not _is_resolved_issue(item):
            normalized_issues.append({"title": item, "description": item, "severity": "medium"})
        elif isinstance(item, dict):
            title = item.get("title") or item.get("description")
            if title and not _is_resolved_issue(f"{title} {item.get('description') or ''}"):
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


def _is_completed_statement(text: str) -> bool:
    """Return True when text describes work already completed, not a pending action."""
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    pending_markers = ("필요", "확인", "검토", "해야", "예정", "미완료", "아직", "남음", "요청", "todo", "할 일")
    if any(marker in normalized for marker in pending_markers):
        return False
    completed_patterns = (
        r"완료(?:했|됐|되었|되었습니다|했습니다|되었습니|됨|했어요|됐어요)",
        r"(?:구현|연결|반영|배포|처리|점검|설정|수정|테스트)\s*완료",
        r"(?:처리|해결|반영|구현|배포|수정)(?:했|됐|되었|되었습니다|했습니다|됨)",
    )
    return any(re.search(pattern, normalized) for pattern in completed_patterns)


def _is_resolved_issue(text: str) -> bool:
    unresolved_markers = ("문제", "오류", "실패", "지연", "위험", "리스크", "발생", "미해결", "계속", "주의")
    normalized = text.lower()
    return _is_completed_statement(text) and not any(marker in normalized for marker in unresolved_markers)


def _heuristic_extract(text: str) -> dict:
    lines = [line.strip() for line in re.split(r"\n+|(?<=[.!?])\s+", text) if line.strip()]
    todos = []
    decisions = []
    issues = []
    for line in lines:
        if not _is_completed_statement(line) and any(token in line for token in ("해야", "필요", "담당", "마감", "TODO", "todo")):
            todos.append({"content": line[:300], "assignee": None, "due_date": None})
        if any(token in line for token in ("결정", "확정", "합의")):
            decisions.append(line[:300])
        if not _is_resolved_issue(line) and any(token in line for token in ("이슈", "문제", "blocked", "Blocked", "리스크", "주의 필요")):
            issues.append({"title": line[:160], "description": line[:300], "severity": "medium"})
    return {"todos": todos[:20], "decisions": decisions[:20], "issues": issues[:20]}


def _fallback_answer(query: str, context: str) -> str:
    if context.strip():
        return f"운영 데이터 분석 결과:\n{_simple_summary(context)}"
    return "관련 데이터를 찾지 못했습니다."
