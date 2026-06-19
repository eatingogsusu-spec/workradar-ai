"""AI summarization/extraction helpers - async version for opsradar2."""

from __future__ import annotations

import json
import csv
import io
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
    csv_claims = _extract_claims_csv(text)
    if csv_claims:
        return csv_claims
    if settings.AI_PROVIDER.lower() != "azure":
        return _heuristic_extract(text)

    prompt = f"""
다음 문서에서 todos, decisions, issues를 JSON으로만 추출하세요.
문장 그대로 복사하지 말고 실행 가능한 업무 항목으로 정리하세요.
Todo title은 담당자가 목록만 보고도 할 일을 즉시 이해하도록 핵심 행동과 대상을 짧고 직관적으로 작성하세요.
Todo description은 title을 반복하지 말고 업무 배경, 수행 범위, 산출물 또는 완료 기준을 1~3문장으로 구체적으로 작성하세요.
이미 완료되었거나 해결되었다고 명확히 표현된 문장은 Todo 또는 Issue 후보로 추출하지 마세요.
이미 완료/해결/반영된 과거 작업은 todos 또는 issues에 포함하지 마세요. 완료 여부를 확인해야 하는 후속 작업만 포함하세요.
각 issue에는 reason 필드를 반드시 포함하세요. reason에는 그 항목을 리스크로 판단한 근거와 원인을
1~2문장으로 구체적으로 적으세요(어떤 표현·반복 패턴·예상 영향 때문에 위험한지). 결과만 적지 말고 원인을 설명하세요.

형식:
{{
  "todos": [{{"title": "해야 할 일", "description": "업무 수행 방법과 완료 기준", "assignee": null, "due_date": null}}],
  "decisions": [""],
  "issues": [{{"title": "", "description": "", "severity": "medium", "reason": "리스크로 판단한 근거와 원인"}}]
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
            concise_title = _concise_todo_title(item, item)
            normalized_todos.append(
                {
                    "title": concise_title,
                    "description": _detailed_todo_description(concise_title, item),
                    "assignee": None,
                    "due_date": None,
                }
            )
        elif isinstance(item, dict):
            title = item.get("title") or item.get("content")
            description = item.get("description") or item.get("content") or title
            if title and not _is_completed_statement(f"{title} {description}"):
                concise_title = _concise_todo_title(str(title), str(description))
                normalized_todos.append(
                    {
                        "title": concise_title,
                        "description": _detailed_todo_description(concise_title, str(description)),
                        "assignee": item.get("assignee"),
                        "due_date": item.get("due_date") or item.get("due_at"),
                    }
                )

    normalized_issues = []
    for item in issues[:20]:
        if isinstance(item, str) and not _is_resolved_issue(item):
            cleaned = _strip_issue_target_date(item)
            if cleaned:
                normalized_issues.append(
                    {"title": cleaned, "description": cleaned, "severity": "medium", "reason": _derive_issue_reason(cleaned)}
                )
        elif isinstance(item, dict):
            title = item.get("title") or item.get("description")
            if title and not _is_resolved_issue(f"{title} {item.get('description') or ''}"):
                cleaned_title = _strip_issue_target_date(str(title))
                cleaned_description = _strip_issue_target_date(str(item.get("description") or title))
                if not cleaned_title:
                    continue
                reason = str(item.get("reason") or "").strip() or _derive_issue_reason(f"{cleaned_title} {cleaned_description}")
                normalized_issues.append(
                    {
                        "title": cleaned_title,
                        "description": cleaned_description or cleaned_title,
                        "severity": item.get("severity") or "medium",
                        "reason": reason,
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


def _derive_issue_reason(text: str) -> str:
    """LLM 이 reason 을 주지 않았을 때(폴백/문자열 추출) 원인 근거를 휴리스틱으로 만든다."""
    markers = [
        marker
        for marker in ("지연", "초과", "실패", "오류", "장애", "blocked", "위험", "리스크", "미해결", "누락", "타임아웃", "고갈", "병목", "중단")
        if marker.lower() in text.lower()
    ]
    if markers:
        return f"운영 리스크 신호({', '.join(markers[:3])})가 문서에서 감지되어 후속 점검이 필요합니다."
    return "문서에서 후속 점검이 필요한 리스크 표현이 감지되었습니다."


def _concise_todo_title(title: str, description: str = "") -> str:
    """Create a scannable action title instead of copying a full source sentence."""
    cleaned = re.sub(r"^(?:[-*•]\s*)?(?:todo|할\s*일|액션\s*아이템)\s*[:：-]?\s*", "", title, flags=re.IGNORECASE)
    cleaned = re.sub(r"(?:오늘|내일|이번\s*주|다음\s*주|이번\s*달|다음\s*달|\d{1,2}월\s*\d{1,2}일)(?:까지|내로)?\s*", "", cleaned)
    cleaned = re.sub(r"(?:해야|하여야)\s*(?:합니다|한다|함|해요)?[.!?]?$", "", cleaned)
    cleaned = re.sub(r"(?:할|할\s*것이)\s*필요(?:가\s*있습니다|합니다|함)?[.!?]?$", "", cleaned)
    cleaned = re.sub(r"(?:바랍니다|해주세요|하십시오|예정입니다)[.!?]?$", "", cleaned)
    cleaned = re.sub(r"(?:합니다|됩니다|입니다)[.!?]?$", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" \t\r\n-·,")
    if len(cleaned) > 72:
        clauses = re.split(r"[.!?。]|(?:\s*[-–—]\s*)|(?:하고|하며|해서|하여)\s+", cleaned)
        cleaned = next((clause.strip() for clause in clauses if 8 <= len(clause.strip()) <= 72), cleaned[:72].rstrip())
    if cleaned == description.strip() and len(cleaned) > 48:
        cleaned = cleaned[:48].rstrip() + " 점검"
    return cleaned[:80] or "업무 항목 확인"


def _detailed_todo_description(title: str, description: str) -> str:
    """Keep useful detail and prevent title/description duplication."""
    cleaned = re.sub(r"\s+", " ", description).strip()
    if not cleaned or cleaned == title:
        return f"{title} 업무의 수행 범위와 필요한 산출물을 확인하고, 완료 기준에 따라 결과를 공유합니다."
    if len(cleaned) < 45:
        return f"{cleaned} 관련 작업 범위와 완료 기준을 확인하고 결과를 공유합니다."
    return cleaned[:500]


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
            title = _concise_todo_title(line, line)
            todos.append(
                {
                    "title": title,
                    "description": _detailed_todo_description(title, line[:500]),
                    "assignee": None,
                    "due_date": None,
                }
            )
        if any(token in line for token in ("결정", "확정", "합의")):
            decisions.append(line[:300])
        if not _is_resolved_issue(line) and any(token in line for token in ("이슈", "문제", "blocked", "Blocked", "리스크", "주의 필요")):
            cleaned_issue = _strip_issue_target_date(line)
            if cleaned_issue:
                issues.append(
                    {
                        "title": cleaned_issue[:160],
                        "description": cleaned_issue[:300],
                        "severity": "medium",
                        "reason": _derive_issue_reason(cleaned_issue),
                    }
                )
    return {"todos": todos[:20], "decisions": decisions[:20], "issues": issues[:20]}


def _extract_claims_csv(text: str) -> dict | None:
    rows = _parse_claim_rows(text)
    if not rows:
        return None

    required = {"claim_id", "defect_type", "claim_status"}
    if not required.issubset({key for row in rows for key in row}):
        return None

    open_statuses = {"received", "under analysis", "corrective action", "in_progress", "in progress", "open"}
    open_rows = [row for row in rows if _claim_status(row) in open_statuses]
    if not open_rows:
        return {"todos": [], "decisions": [], "issues": []}

    ordered = sorted(open_rows, key=_claim_sort_key)
    issues = [_claim_issue(row) for row in ordered[:20]]
    todos = [_claim_todo(row) for row in ordered[:20]]
    return {"todos": todos, "decisions": [], "issues": issues}


def _parse_claim_rows(text: str) -> list[dict[str, str]]:
    rows = _parse_key_value_rows(text)
    if rows:
        return rows

    try:
        reader = csv.DictReader(io.StringIO(text))
        return [
            {str(key or "").strip(): str(value or "").strip() for key, value in row.items()}
            for row in reader
            if any(str(value or "").strip() for value in row.values())
        ]
    except csv.Error:
        return []


def _parse_key_value_rows(text: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in text.splitlines():
        if "claim_id:" not in line or " / " not in line:
            continue
        row: dict[str, str] = {}
        for part in line.split(" / "):
            if ":" not in part:
                continue
            key, value = part.split(":", 1)
            key = key.strip()
            value = value.strip()
            if key:
                row[key] = value
        if row:
            rows.append(row)
    return rows


def _claim_status(row: dict[str, str]) -> str:
    return str(row.get("claim_status") or row.get("status") or "").strip().lower()


def _claim_sort_key(row: dict[str, str]) -> tuple[int, int]:
    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    status_rank = {"received": 0, "under analysis": 1, "corrective action": 2, "in_progress": 2, "in progress": 2, "open": 3}
    severity = str(row.get("severity") or "").strip().lower()
    return (severity_rank.get(severity, 4), status_rank.get(_claim_status(row), 4))


def _claim_issue(row: dict[str, str]) -> dict[str, str]:
    claim_id = row.get("claim_id") or "claim"
    product = row.get("product_id") or "제품"
    defect = row.get("defect_type") or "품질 이상"
    quantity = row.get("defect_quantity") or row.get("quantity") or ""
    severity = _normalize_claim_severity(row.get("severity"))
    title = f"{product} {defect} 클레임"
    if quantity:
        title = f"{title} {quantity}건"
    description = _claim_description(row)
    reason = (
        f"{claim_id}가 {row.get('claim_status') or 'open'} 상태이고 "
        f"심각도 {row.get('severity') or '미지정'}, 불량 수량 {quantity or '미지정'}건으로 기록되어 "
        "품질 리스크 추적이 필요합니다."
    )
    return {
        "title": title,
        "description": description,
        "severity": severity,
        "reason": reason,
    }


def _claim_todo(row: dict[str, str]) -> dict[str, str | None]:
    claim_id = row.get("claim_id") or "claim"
    product = row.get("product_id") or "제품"
    defect = row.get("defect_type") or "품질 이상"
    status = _claim_status(row)
    action = {
        "received": "접수 내용 확인 및 초기 대응 계획 수립",
        "under analysis": "원인 분석 결과 정리",
        "corrective action": "시정조치 진행 상황 확인",
        "in_progress": "시정조치 진행 상황 확인",
        "in progress": "시정조치 진행 상황 확인",
    }.get(status, "후속 조치 계획 수립")
    return {
        "title": f"{claim_id} {action}",
        "description": f"{product} {defect} 클레임에 대해 {_claim_description(row)}",
        "assignee": row.get("quality_owner") or None,
        "due_date": None,
        "priority": _normalize_claim_severity(row.get("severity")),
    }


def _claim_description(row: dict[str, str]) -> str:
    parts = [
        f"클레임 ID {row.get('claim_id')}" if row.get("claim_id") else "",
        f"접수일 {row.get('claim_date')}" if row.get("claim_date") else "",
        f"고객 {row.get('customer_id')}" if row.get("customer_id") else "",
        f"제품 {row.get('product_id')}" if row.get("product_id") else "",
        f"불량 유형 {row.get('defect_type')}" if row.get("defect_type") else "",
        f"수량 {row.get('defect_quantity')}건" if row.get("defect_quantity") else "",
        f"상태 {row.get('claim_status')}" if row.get("claim_status") else "",
        f"담당자 {row.get('quality_owner')}" if row.get("quality_owner") else "",
        f"관련 이슈 {row.get('related_issue_id')}" if row.get("related_issue_id") else "",
    ]
    return ", ".join(part for part in parts if part) + "."


def _normalize_claim_severity(value: str | None) -> str:
    severity = str(value or "medium").strip().lower()
    if severity in {"critical", "high", "medium", "low"}:
        return severity
    return "medium"


def _fallback_answer(query: str, context: str) -> str:
    if context.strip():
        return f"운영 데이터 분석 결과:\n{_simple_summary(context)}"
    return "관련 데이터를 찾지 못했습니다."
