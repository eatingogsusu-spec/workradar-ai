"""AI summarization/extraction helpers - async version for opsradar2."""

from __future__ import annotations

import json
import csv
import io
import re
from datetime import date, timedelta
from typing import Any

from app.ai.llm_client import AzureOpenAIConfigError, chat_completion
from app.core.config import settings


# 한 문서에서 등록할 todo/issue 상한(대시보드 폭주 방지). 초과분은 잘리되,
# truncation 메타로 "전체 N건 중 cap건만 처리됨"을 사용자에게 알린다.
EXTRACTION_CAP = 20

# summarize_document() and extract_todos() run back to back on the same text. Both
# prompts must begin with these exact bytes so the second call hits the first call's
# cached prompt prefix — keep them identical, and keep the document at the very front.
_JSON_SYSTEM_PROMPT = "Return only valid JSON."
_DOCUMENT_BLOCK = "[문서]"


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
    if not settings.llm_enabled:
        return {"summary": _simple_summary(text), "keywords": _simple_keywords(text)}

    # The document goes first, and extract_todos() opens with the byte-identical block.
    # Ingesting a prompt costs ~2.5ms/token on the local model, and the pipeline feeds
    # the same document to both calls back to back — so leading with it lets the second
    # call reuse this one's cached KV prefix instead of paying for the document twice.
    prompt = (
        f"{_DOCUMENT_BLOCK}\n{text[:10000]}\n\n"
        "위 문서를 3줄 이내로 요약하고 핵심 키워드 5개를 JSON으로만 반환하세요.\n"
        '형식: {"summary":"", "keywords":[""]}'
    )
    try:
        raw = await chat_completion(prompt, system_prompt=_JSON_SYSTEM_PROMPT, temperature=0.1)
        return _parse_json(raw, {"summary": _simple_summary(text), "keywords": _simple_keywords(text)})
    except Exception:
        return {"summary": _simple_summary(text), "keywords": _simple_keywords(text)}


async def extract_todos(document_text: str, *, document_date: date | None = None) -> dict:
    text = document_text.strip()
    if not text:
        return {"todos": [], "decisions": [], "issues": []}
    csv_claims = _extract_claims_csv(text)
    if csv_claims:
        return csv_claims
    if not settings.llm_enabled:
        return _heuristic_extract(text)

    base_date = _document_date(text) or document_date or date.today()

    # Must open with the exact same document block as summarize_document(), which runs
    # immediately before this in the pipeline, so the model reuses its cached KV prefix
    # instead of re-ingesting the whole document at ~2.5ms/token.
    prompt = f"""{_DOCUMENT_BLOCK}
{text[:10000]}

이 문서의 기준일은 {base_date.isoformat()}입니다.
위 문서에서 todos, decisions, issues를 JSON으로만 추출하세요.
문장 그대로 복사하지 말고 실행 가능한 업무 항목으로 정리하세요.
Todo title은 담당자가 목록만 보고도 할 일을 즉시 이해하도록 핵심 행동과 대상을 짧고 직관적으로 작성하세요.
Todo description은 title을 반복하지 말고 업무 배경, 수행 범위, 산출물 또는 완료 기준을 1~3문장으로 구체적으로 작성하세요.
문서에 고객사, 구매처, 제품명, 품목명, 모델명 또는 부품번호(예: AP-SC-330)가 있으면 Todo와 Issue의 subject에 원문 표현을 그대로 넣고,
title과 description에도 그 대상을 명확히 포함하세요. 정확한 대상이 문서에 있는데 "물품", "재고", "제품"처럼 일반명으로만 바꾸지 마세요.
정확한 제품/품목을 확인할 수 없으면 subject는 null로 두고, title 또는 description에 "대상 품목 확인 필요"를 표시하세요. 원문에 없는 품번이나 제품명을 만들지 마세요.
이미 완료되었거나 해결되었다고 명확히 표현된 문장은 Todo 또는 Issue 후보로 추출하지 마세요.
이미 완료/해결/반영된 과거 작업은 todos 또는 issues에 포함하지 마세요. 완료 여부를 확인해야 하는 후속 작업만 포함하세요.
담당자(assignee)는 문서 원문에 사람 이름이 명시된 경우에만 그 이름을 그대로 입력하고, 부서·역할·키워드만으로 사람을 추정하지 마세요. 근거가 없으면 null입니다.
마감일(due_date)은 이 문서의 기준일 {base_date.isoformat()} (요일: {"월화수목금토일"[base_date.weekday()]})을 기준으로 계산해 반드시 YYYY-MM-DD 형식으로 입력하세요.
- 절대 표기("7/16", "7월 16일", "2026-07-16")가 있으면 연도를 기준일에서 채워 그대로 변환하세요. 예: 기준일이 2026년이고 원문이 "7/16"이면 2026-07-16.
- 상대 표기도 기준일 기준으로 반드시 계산하세요. "오늘"=기준일, "내일"=기준일+1일, "모레"=기준일+2일, "3일 내"=기준일+3일, "다음 주"=기준일+7일.
- 요일 표기("금요일까지", "다음 주 수요일")도 기준일 이후 가장 가까운 그 요일로 계산하세요. 기준일이 이미 그 요일이면 다음 주의 같은 요일입니다.
- 각 Todo마다 그 업무에 실제로 걸린 기한을 개별적으로 판단하세요. 여러 Todo에 같은 날짜를 기계적으로 복사하지 마세요.
- 단, 원문에 기한 표현이 전혀 없는 업무는 due_date를 null로 두세요. 우선순위나 심각도만으로 날짜를 지어내지 마세요.
각 issue에는 reason 필드를 반드시 포함하세요. reason에는 그 항목을 리스크로 판단한 근거와 원인을
1~2문장으로 구체적으로 적으세요(어떤 표현·반복 패턴·예상 영향 때문에 위험한지). 결과만 적지 말고 원인을 설명하세요.

형식:
{{
  "todos": [{{"title": "해야 할 일", "description": "업무 수행 방법과 완료 기준", "subject": null, "assignee": null, "due_date": null}}],
  "decisions": [""],
  "issues": [{{"title": "", "description": "", "subject": null, "severity": "medium", "reason": "리스크로 판단한 근거와 원인"}}]
}}
"""
    try:
        raw = await chat_completion(prompt, system_prompt=_JSON_SYSTEM_PROMPT, temperature=0.1)
        parsed = _parse_json(raw, _heuristic_extract(text))
        return _normalize_extraction(parsed, text, base_date)
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


def _grounded_assignee(value: Any, source_text: str) -> str | None:
    candidate = str(value or "").strip()
    return candidate if candidate and candidate in source_text else None


_WEEKDAYS = {"월": 0, "화": 1, "수": 2, "목": 3, "금": 4, "토": 5, "일": 6}


def _document_date(source_text: str) -> date | None:
    """The date the document itself was written — the anchor for relative deadlines.

    "내일" in a note written 2026-05-17 means 2026-05-18, not tomorrow-from-now.
    """
    header = re.search(
        r"(?:작성일|작성 ?일자|문서 ?일자|회의 ?일자|일자|날짜)\s*[:：]?\s*(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})",
        source_text,
    )
    if header:
        try:
            return date(int(header.group(1)), int(header.group(2)), int(header.group(3)))
        except ValueError:
            return None
    return None


def _relative_due_candidates(source_text: str, base: date) -> set[date]:
    """Dates that relative expressions in the source resolve to, anchored on `base`.

    Only expressions actually present in the text produce a candidate, so the LLM
    still cannot invent a deadline the document never mentions.
    """
    candidates: set[date] = set()
    if re.search(r"오늘|금일", source_text):
        candidates.add(base)
    if re.search(r"내일|익일", source_text):
        candidates.add(base + timedelta(days=1))
    if re.search(r"모레|내일모레", source_text):
        candidates.add(base + timedelta(days=2))

    for count in re.findall(r"(\d+)\s*(?:영업)?\s*일\s*(?:내|후|이내|안)", source_text):
        candidates.add(base + timedelta(days=int(count)))
    for count in re.findall(r"(\d+)\s*주\s*(?:내|후|이내|안)", source_text):
        candidates.add(base + timedelta(weeks=int(count)))

    # "금요일", "이번 주 금요일", "다음 주 수요일", "차주 월요일"
    for prefix, hangul in re.findall(r"(다음\s*주|차주|이번\s*주|금주)?\s*([월화수목금토일])\s*요일", source_text):
        target = _WEEKDAYS[hangul]
        if re.match(r"다음\s*주|차주", prefix or ""):
            # the named day inside the *following* calendar week
            next_monday = base + timedelta(days=7 - base.weekday())
            candidates.add(next_monday + timedelta(days=target))
            continue
        ahead = (target - base.weekday()) % 7
        if ahead == 0:
            ahead = 7  # a weekday named in a document means the next one, not today
        upcoming = base + timedelta(days=ahead)
        candidates.add(upcoming)
        # "금요일까지" written late in the week can also mean the following one
        candidates.add(upcoming + timedelta(days=7))

    if re.search(r"이번\s*주\s*말|주말까지|금주\s*말", source_text):
        candidates.add(base + timedelta(days=(4 - base.weekday()) % 7 or 7))
    if re.search(r"월말|이달\s*말", source_text):
        next_month = date(base.year + (base.month == 12), (base.month % 12) + 1, 1)
        candidates.add(next_month - timedelta(days=1))
    return candidates


def _grounded_due_date(value: Any, source_text: str, base_date: date | None = None) -> str | None:
    """Accept a model-supplied deadline only if the document actually justifies it.

    Absolute dates must appear in the text; relative ones must resolve, from the
    document's own date, to an expression that appears in the text.
    """
    raw = str(value or "").strip()
    base = base_date or _document_date(source_text) or date.today()

    matched = re.fullmatch(r"(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})", raw)
    if matched:
        year, month, day = (int(g) for g in matched.groups())
    else:
        # the model sometimes echoes the document's own shorthand ("7/16", "7월 16일")
        short = re.fullmatch(r"(\d{1,2})\s*[/.월-]\s*(\d{1,2})\s*일?", raw)
        if not short:
            return None
        month, day = int(short.group(1)), int(short.group(2))
        year = base.year
        if month < base.month - 6:  # shorthand that has wrapped past new year
            year += 1

    try:
        parsed = date(year, month, day)
    except ValueError:
        return None

    # Korean runs straight into the digits ("7/16까지"), and \w matches Hangul, so
    # \b never fires there. Guard with digit-only lookarounds instead.
    absolute_patterns = (
        rf"(?<!\d){parsed.year}[./-]0?{parsed.month}[./-]0?{parsed.day}(?!\d)",
        rf"(?<![\d/.-])0?{parsed.month}[./-]0?{parsed.day}(?![\d/.-])",
        rf"(?<!\d)0?{parsed.month}\s*월\s*0?{parsed.day}\s*일",
    )
    if any(re.search(pattern, source_text) for pattern in absolute_patterns):
        return parsed.isoformat()

    if parsed in _relative_due_candidates(source_text, base):
        return parsed.isoformat()
    return None


def _normalize_extraction(
    data: dict[str, Any], source_text: str = "", base_date: date | None = None
) -> dict:
    todos = data.get("todos") if isinstance(data.get("todos"), list) else []
    decisions = data.get("decisions") if isinstance(data.get("decisions"), list) else []
    issues = data.get("issues") if isinstance(data.get("issues"), list) else []

    normalized_todos = []
    for item in todos[:EXTRACTION_CAP]:
        if isinstance(item, str) and not _is_completed_statement(item):
            subject = _detect_subject(item)
            concise_title = _with_subject_title(_concise_todo_title(item, item), subject)
            normalized_todos.append(
                {
                    "title": concise_title,
                    "description": _with_subject_description(_detailed_todo_description(concise_title, item), subject),
                    "subject": subject,
                    "assignee": None,
                    "due_date": None,
                }
            )
        elif isinstance(item, dict):
            title = item.get("title") or item.get("content")
            description = item.get("description") or item.get("content") or title
            if title and not _is_completed_statement(f"{title} {description}"):
                subject = _normalize_subject(item.get("subject")) or _detect_subject(f"{title} {description}")
                concise_title = _with_subject_title(_concise_todo_title(str(title), str(description)), subject)
                normalized_todos.append(
                    {
                        "title": concise_title,
                        "description": _with_subject_description(_detailed_todo_description(concise_title, str(description)), subject),
                        "subject": subject,
                        "assignee": _grounded_assignee(item.get("assignee"), source_text),
                        "due_date": _grounded_due_date(
                            item.get("due_date") or item.get("due_at"), source_text, base_date
                        ),
                    }
                )

    normalized_issues = []
    for item in issues[:EXTRACTION_CAP]:
        if isinstance(item, str) and not _is_resolved_issue(item):
            cleaned = _strip_issue_target_date(item)
            if cleaned:
                subject = _detect_subject(cleaned)
                normalized_issues.append(
                    {
                        "title": _with_subject_title(cleaned, subject),
                        "description": _with_subject_description(cleaned, subject),
                        "subject": subject,
                        "severity": "medium",
                        "reason": _derive_issue_reason(cleaned),
                    }
                )
        elif isinstance(item, dict):
            title = item.get("title") or item.get("description")
            if title and not _is_resolved_issue(f"{title} {item.get('description') or ''}"):
                cleaned_title = _strip_issue_target_date(str(title))
                cleaned_description = _strip_issue_target_date(str(item.get("description") or title))
                if not cleaned_title:
                    continue
                subject = _normalize_subject(item.get("subject")) or _detect_subject(f"{cleaned_title} {cleaned_description}")
                reason = str(item.get("reason") or "").strip() or _derive_issue_reason(f"{cleaned_title} {cleaned_description}")
                normalized_issues.append(
                    {
                        "title": _with_subject_title(cleaned_title, subject),
                        "description": _with_subject_description(cleaned_description or cleaned_title, subject),
                        "subject": subject,
                        "severity": item.get("severity") or "medium",
                        "reason": reason,
                    }
                )

    result = {
        "todos": normalized_todos,
        "decisions": [str(item) for item in decisions[:EXTRACTION_CAP]],
        "issues": normalized_issues,
    }
    if len(todos) > EXTRACTION_CAP or len(issues) > EXTRACTION_CAP:
        result["truncation"] = {
            "cap": EXTRACTION_CAP,
            "todos_total": len(todos),
            "issues_total": len(issues),
            "truncated": True,
        }
    return result


def _strip_issue_target_date(text: str) -> str:
    """Remove target-date metadata from issue candidate title and description."""
    cleaned = re.sub(
        r"(?:목표\s*날짜|목표일|target\s*date)\s*[:：-]?\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}",
        "",
        text,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s{2,}", " ", cleaned).strip(" \t\r\n-·,")


_GENERIC_SUBJECTS = {
    "물품", "재고", "제품", "품목", "부품", "자재", "원자재", "상품", "대상", "대상 품목",
}


def _normalize_subject(value: object) -> str | None:
    subject = re.sub(r"\s+", " ", str(value or "")).strip(" \t\r\n-·,.:;")
    if not subject or subject.lower() in _GENERIC_SUBJECTS:
        return None
    return subject[:120]


def _detect_subject(text: str) -> str | None:
    """Extract an explicitly named product, part, or model without inventing one."""
    normalized = " ".join(str(text or "").split())
    labelled = re.search(
        r"(?:제품|품목|부품|모델|자재|물품|재고)(?:명|번호|코드)?\s*[:：]\s*([^,;\n]{2,100})",
        normalized,
        flags=re.IGNORECASE,
    )
    if labelled:
        subject = _normalize_subject(labelled.group(1))
        if subject:
            return subject

    for match in re.finditer(r"\b[A-Z]{1,6}(?:-[A-Z0-9]{1,10}){1,4}\b", normalized):
        code = match.group(0)
        if code.split("-", 1)[0] in {"DOC", "ISSUE", "TODO", "API"}:
            continue
        trailing = normalized[match.end():]
        suffix = re.match(r"(?:\s+[A-Za-z가-힣0-9]+){0,3}", trailing)
        candidate = f"{code}{suffix.group(0) if suffix else ''}".strip()
        subject = _normalize_subject(candidate)
        if subject:
            return subject
    return None


def _with_subject_title(title: str, subject: str | None) -> str:
    cleaned = re.sub(r"\s+", " ", str(title or "")).strip()
    if subject:
        if subject.lower() not in cleaned.lower():
            cleaned = f"{subject} - {cleaned}"
    elif re.search(r"(?:물품|재고|제품|품목|부품|자재)", cleaned) and "대상 품목 확인 필요" not in cleaned:
        cleaned = f"{cleaned} (대상 품목 확인 필요)"
    return cleaned[:160] or "업무 항목 확인"


def _with_subject_description(description: str, subject: str | None) -> str:
    cleaned = re.sub(r"\s+", " ", str(description or "")).strip()
    if subject and subject.lower() not in cleaned.lower():
        return f"대상 품목: {subject}. {cleaned}"[:2000]
    if not subject and re.search(r"(?:물품|재고|제품|품목|부품|자재)", cleaned) and "대상 품목 확인 필요" not in cleaned:
        return f"{cleaned} 대상 품목 확인 필요."[:2000]
    return cleaned[:2000]


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
    return cleaned[:2000]


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
            subject = _detect_subject(line)
            title = _with_subject_title(_concise_todo_title(line, line), subject)
            todos.append(
                {
                    "title": title,
                    "description": _with_subject_description(_detailed_todo_description(title, line[:500]), subject),
                    "subject": subject,
                    "assignee": None,
                    "due_date": None,
                }
            )
        if any(token in line for token in ("결정", "확정", "합의")):
            decisions.append(line[:300])
        if not _is_resolved_issue(line) and any(token in line for token in ("이슈", "문제", "blocked", "Blocked", "리스크", "주의 필요")):
            cleaned_issue = _strip_issue_target_date(line)
            if cleaned_issue:
                subject = _detect_subject(cleaned_issue)
                issues.append(
                    {
                        "title": _with_subject_title(cleaned_issue, subject),
                        "description": _with_subject_description(cleaned_issue, subject),
                        "subject": subject,
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
    capped = ordered[:EXTRACTION_CAP]
    issues = [_claim_issue(row) for row in capped]
    todos = [_claim_todo(row) for row in capped]
    result = {"todos": todos, "decisions": [], "issues": issues}
    total = len(open_rows)
    if total > EXTRACTION_CAP:
        result["truncation"] = {
            "cap": EXTRACTION_CAP,
            "todos_total": total,
            "issues_total": total,
            "truncated": True,
        }
    return result


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
