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

    prompt = f"""당신은 OpsRadar 운영 데이터 분석 AI입니다.
아래 운영 데이터와 RAG 문서를 종합해서 사용자 질문에 정확하고 도움이 되게 답하세요.

[OpsRadar 운영 데이터]
{context or "데이터 없음"}

[사용자 질문]
{query}

[답변 규칙]
1. 질문의 의도를 먼저 파악하고, 질문에 직접 답하는 정보만 우선 제시하세요.
2. 완료 여부나 담당자를 묻는 질문은 실제 Todo의 title, description, status, assignee를 근거로 단정적으로 답하세요.
3. 같은 제목의 항목이 여러 개면 중복 나열하지 말고, 상태 차이가 있으면 데이터 불일치라고 짧게 설명하세요.
4. 용어나 기술 개념 질문은 정의, OpsRadar에서의 사용 방식, 관련 근거 순서로 설명하세요.
5. 사람의 업무를 묻는 경우에만 담당 Todo, 관련 Issue, 문서 언급을 구분해 요약하세요.
6. 근거가 없으면 추측하지 말고 어떤 데이터가 부족한지 명시하세요.
7. 반드시 한국어로 답변하고, 불필요한 고정 형식이나 상투적인 운영 요약은 피하세요.
"""
    try:
        answer = await chat_completion(
            prompt,
            system_prompt="당신은 OpsRadar 운영 데이터 분석 AI입니다. 반드시 한국어로 답변하세요. RAG 문서와 운영 데이터를 종합해서 구체적이고 실용적인 답변을 제공하세요.",
            temperature=0.3,
        )
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
이미 완료/해결/반영된 과거 작업은 todos 또는 issues에 포함하지 마세요. 완료 여부를 확인해야 하는 후속 작업만 포함하세요.

형식:
{{
  "todos": [{{"title": "해야 할 일", "description": "업무 수행 방법과 완료 기준", "assignee": null, "due_date": null}}],
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
            normalized_todos.append(
                {
                    "title": str(item)[:160],
                    "description": str(item),
                    "assignee": None,
                    "due_date": None,
                }
            )
        elif isinstance(item, dict):
            title = item.get("title") or item.get("content")
            description = item.get("description") or item.get("content") or title
            if title and not _is_completed_statement(f"{title} {description}"):
                normalized_todos.append(
                    {
                        "title": str(title)[:160],
                        "description": str(description),
                        "assignee": item.get("assignee"),
                        "due_date": item.get("due_date") or item.get("due_at"),
                    }
                )

    normalized_issues = []
    for item in issues[:20]:
        if isinstance(item, str) and not _is_resolved_issue(item):
            cleaned = _strip_issue_target_date(item)
            if cleaned:
                normalized_issues.append({"title": cleaned, "description": cleaned, "severity": "medium"})
        elif isinstance(item, dict):
            title = item.get("title") or item.get("description")
            if title and not _is_resolved_issue(f"{title} {item.get('description') or ''}"):
                cleaned_title = _strip_issue_target_date(str(title))
                cleaned_description = _strip_issue_target_date(str(item.get("description") or title))
                if not cleaned_title:
                    continue
                normalized_issues.append(
                    {
                        "title": cleaned_title,
                        "description": cleaned_description or cleaned_title,
                        "severity": item.get("severity") or "medium",
                    }
                )

    return {
        "todos": normalized_todos,
        "decisions": [str(item) for item in decisions[:20]],
        "issues": normalized_issues,
    }


def _strip_issue_target_date(text: str) -> str:
    """Remove target-date metadata from issue candidate title and description."""
    cleaned = re.sub(
        r"(?:목표\s*날짜|목표일|target\s*date)\s*[:：-]?\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s{2,}", " ", cleaned).strip(" \t\r\n-·,")


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
            title = re.sub(r"^(?:[-*•]\s*)?(?:todo|할\s*일|액션\s*아이템)\s*[:：-]?\s*", "", line, flags=re.IGNORECASE)
            todos.append(
                {
                    "title": title[:160],
                    "description": line[:300],
                    "assignee": None,
                    "due_date": None,
                }
            )
        if any(token in line for token in ("결정", "확정", "합의")):
            decisions.append(line[:300])
        if not _is_resolved_issue(line) and any(token in line for token in ("이슈", "문제", "blocked", "Blocked", "리스크", "주의 필요")):
            cleaned_issue = _strip_issue_target_date(line)
            if cleaned_issue:
                issues.append({"title": cleaned_issue[:160], "description": cleaned_issue[:300], "severity": "medium"})
    return {"todos": todos[:20], "decisions": decisions[:20], "issues": issues[:20]}


def _fallback_answer(query: str, context: str) -> str:
    if context.strip():
        return f"운영 데이터 분석 결과:\n{_simple_summary(context)}"
    return "관련 데이터를 찾지 못했습니다."
