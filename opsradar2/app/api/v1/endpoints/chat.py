"""UC-07 AI assistant endpoints."""

from __future__ import annotations

import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_client import AzureOpenAIConfigError
from app.ai.retriever import build_context, retrieve
from app.ai.summarizer import answer_question, extract_todos
from app.core.config import settings
from app.core.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.assistant_context_service import AssistantContextService

router = APIRouter()

ACTIVE_TODO_STATUSES = {"pending", "in_progress", "blocked", "approved"}
COMPLETED_TODO_STATUSES = {"completed", "done", "resolved"}
TERM_GLOSSARY = {
    "rag": (
        "RAG(Retrieval-Augmented Generation)는 질문과 관련된 사내 문서나 운영 데이터를 먼저 검색한 뒤, "
        "검색 결과를 근거로 AI가 답변을 생성하는 방식입니다. WorkRader에서는 업로드 문서를 chunk로 나누고 "
        "임베딩하여 FAISS에서 관련 내용을 찾은 다음, 현재 Todo·Issue·Calendar 데이터와 함께 답변에 사용합니다."
    ),
    "faiss": "FAISS는 문장 임베딩 간 유사도를 빠르게 검색하는 벡터 검색 엔진입니다. WorkRader의 문서 RAG 검색에 사용됩니다.",
    "임베딩": "임베딩은 문장이나 문서를 의미를 보존한 숫자 벡터로 변환하는 과정입니다. 비슷한 내용일수록 가까운 벡터가 됩니다.",
}


class ExtractRequest(BaseModel):
    text: str = Field(min_length=1)


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Answer with current WorkRader data, plus document RAG when available."""
    operational_context, operational_sources = await AssistantContextService(db).build_context()
    team_members = await _load_team_members(db)

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
    knowledge_answer = _local_knowledge_answer(payload.message, rag_context)
    if knowledge_answer:
        answer = knowledge_answer
    elif _is_operational_question(payload.message):
        answer = _local_answer(payload.message, operational_context, team_members)
    elif settings.AI_PROVIDER.lower() != "azure":
        answer = _local_knowledge_answer(payload.message, rag_context) or _local_answer(payload.message, operational_context, team_members)
    else:
        try:
            answer_result = await answer_question(payload.message, context)
            answer = answer_result.get("answer", "")
        except Exception:
            answer = _local_answer(payload.message, operational_context, team_members)

        if not answer.strip() or "AI_PROVIDER=azure" in answer:
            answer = _local_answer(payload.message, operational_context, team_members)

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
    if any(term in lowered for term in TERM_GLOSSARY) and any(token in message for token in ("뭐야", "무엇", "설명", "뜻")):
        return False
    tokens = (
        "todo", "issue", "calendar",
        "할 일", "미완료", "이슈", "위험", "리스크", "일정", "캘린더",
        "업무", "담당", "현황", "완료", "진행", "구현", "상태",
    )
    return any(token in lowered or token in message for token in tokens)


def _local_knowledge_answer(message: str, rag_context: str) -> str | None:
    """Answer terminology questions without incorrectly falling back to an operations summary."""
    lowered = message.lower()
    for term, definition in TERM_GLOSSARY.items():
        if term in lowered:
            return f"**{term.upper() if term.isascii() else term}란?**\n\n{definition}"
    if rag_context.strip() and any(token in message for token in ("뭐야", "무엇", "설명", "알려줘")):
        excerpts = [line.strip() for line in rag_context.splitlines() if line.strip() and not line.startswith("[source:")]
        if excerpts:
            return "관련 문서에서 확인한 내용입니다.\n\n" + "\n".join(f"- {line}" for line in excerpts[:5])
    return None


async def _load_team_members(db: AsyncSession) -> list[str]:
    result = await db.execute(
        text(
            """
            SELECT DISTINCT u.name
            FROM project_members pm
            JOIN users u ON u.id = pm.user_id
            WHERE u.deleted_at IS NULL
              AND pm.status = 'active'
              AND COALESCE(u.name, '') <> ''
            ORDER BY u.name
            """
        )
    )
    return [row[0] for row in result.all()]


def _extract_member_name(message: str, team_members: list[str]) -> str | None:
    """질문에서 팀원 이름 추출"""
    for member in team_members:
        if member in message:
            return member
    return None


def _filter_by_assignee(items: list[str], assignee: str) -> list[str]:
    """특정 담당자의 항목만 필터링"""
    filtered = []
    for item in items:
        if f"assignee={assignee}" in item:
            filtered.append(item)
    return filtered


def _field(item: str, name: str, default: str = "") -> str:
    prefix = f"{name}="
    return next((part[len(prefix):].strip() for part in item.split(" | ") if part.startswith(prefix)), default)


def _title(item: str) -> str:
    return item.lstrip("- ").split(" | ", 1)[0].strip()


def _is_task_lookup_question(message: str) -> bool:
    lowered = message.lower()
    if ("todo" in lowered or "할 일" in message or "할일" in message) and any(
        marker in message for marker in ("미완료", "완료 목록", "전체", "목록")
    ):
        return False
    markers = ("담당", "누구", "구현", "완료", "끝났", "됐어", "되었", "진행", "상태", "맡")
    return any(marker in lowered or marker in message for marker in markers)


def _task_keywords(message: str, team_members: list[str] | None = None) -> list[str]:
    lowered = message.lower()
    stopwords = {
        "현재", "지금", "업무", "관련", "누가", "누구", "담당", "담당자", "상태", "진행", "진행중",
        "구현", "완료", "했어", "했나요", "됐어", "되었어", "알려줘", "무엇", "뭐야", "인가요",
        "todo", "issue", "이슈", "할일", "해줘", "씨",
    }
    words = re.findall(r"[a-zA-Z0-9_/-]{2,}|[가-힣]{2,}", lowered)
    member_names = {member.lower() for member in (team_members or [])}
    return [word for word in words if word not in stopwords and word not in member_names]


def _find_matching_items(message: str, items: list[str], team_members: list[str] | None = None) -> list[str]:
    keywords = _task_keywords(message, team_members)
    if not keywords:
        return []
    scored = []
    for item in items:
        haystack = f"{_title(item)} {_field(item, 'description')}".lower()
        score = sum(3 if keyword in _title(item).lower() else 1 for keyword in keywords if keyword in haystack)
        if score:
            scored.append((score, item))
    if not scored:
        return []

    strongest = max(score for score, _ in scored)
    relevant = [(score, item) for score, item in scored if score >= max(2, strongest * 0.6)]
    status_rank = {
        "completed": 6,
        "done": 6,
        "resolved": 6,
        "in_progress": 5,
        "blocked": 4,
        "approved": 3,
        "pending": 2,
        "rejected": 1,
    }
    selected: dict[str, tuple[int, int, str]] = {}
    for score, item in relevant:
        key = re.sub(r"\s+", " ", _title(item).lower()).strip()
        rank = status_rank.get(_field(item, "status"), 0)
        if _field(item, "assignee") not in ("", "담당자 미지정"):
            rank += 1
        previous = selected.get(key)
        if previous is None or (score, rank) > (previous[0], previous[1]):
            selected[key] = (score, rank, item)
    return [item for _, _, item in sorted(selected.values(), key=lambda row: (row[0], row[1]), reverse=True)]


def _status_label(status: str) -> str:
    return {
        "pending": "대기",
        "approved": "승인됨",
        "in_progress": "진행 중",
        "blocked": "차단됨",
        "completed": "완료",
        "done": "완료",
        "resolved": "해결됨",
        "rejected": "반려",
    }.get(status, status or "상태 미지정")


def _answer_task_lookup(
    message: str,
    sections: dict[str, list[str]],
    team_members: list[str] | None = None,
) -> str | None:
    matches = _find_matching_items(message, sections.get("Todos", []), team_members)
    if not matches:
        return None
    lines = ["🔎 **질문과 관련된 Todo를 확인했습니다.**\n"]
    for item in matches[:5]:
        title = _title(item)
        status = _field(item, "status")
        assignee = _field(item, "assignee", "담당자 미지정")
        description = _field(item, "description")
        due = _field(item, "due")
        lines.append(f"- **{title}**")
        lines.append(f"  상태: {_status_label(status)} · 담당자: {assignee}")
        if description and description != "설명 없음":
            lines.append(f"  내용: {description}")
        if due and due != "no due date":
            lines.append(f"  마감: {due}")
    if len(matches) > 5:
        lines.append(f"\n관련 항목이 {len(matches)}개이며, 연관도가 높은 5개를 표시했습니다.")
    return "\n".join(lines)


def _query_year(message: str) -> int:
    """질문 속 상대 연도 표현을 실제 연도로 변환합니다."""
    current_year = date.today().year
    if "내년" in message or "다음 해" in message or "다음년도" in message or "다음 연도" in message:
        return current_year + 1
    if "작년" in message or "지난해" in message or "전년도" in message:
        return current_year - 1
    return current_year


def _extract_date_filter(message: str) -> str | None:
    """질문에서 날짜를 YYYY-MM-DD로 추출합니다.

    연도 언급이 없으면 올해 기준, '내년'은 다음 해, 명시 연도는 해당 연도로 해석합니다.
    """
    iso = re.search(r"(20\d{2})[-./](\d{1,2})[-./](\d{1,2})", message)
    if iso:
        year, month, day = map(int, iso.groups())
        return f"{year:04d}-{month:02d}-{day:02d}"

    korean = re.search(r"(?:(20\d{2})년\s*)?(\d{1,2})월\s*(\d{1,2})일", message)
    if korean:
        year = int(korean.group(1)) if korean.group(1) else _query_year(message)
        month = int(korean.group(2))
        day = int(korean.group(3))
        return f"{year:04d}-{month:02d}-{day:02d}"

    slash = re.search(r"(?<!\d)(\d{1,2})[/-](\d{1,2})(?!\d)", message)
    if slash:
        year = _query_year(message)
        month, day = map(int, slash.groups())
        return f"{year:04d}-{month:02d}-{day:02d}"

    return None


def _filter_by_date(items: list[str], target_date: str) -> list[str]:
    """created/due/starts_at 날짜가 질문 날짜와 같은 항목만 남깁니다."""
    markers = (
        f"created={target_date}",
        f"due={target_date}",
        f"starts_at={target_date}",
    )
    return [item for item in items if any(marker in item for marker in markers)]


def _unassigned_count(items: list[str]) -> int:
    """담당자 미지정 항목 수를 계산합니다."""
    return sum(1 for item in items if "assignee=담당자 미지정" in item)


def _assignee_empty_message(member_name: str, item_label: str, target_date: str | None, all_items: list[str]) -> str:
    """담당자 질문에서 배정 데이터가 없을 때 기준을 분명히 안내합니다."""
    when = f"{target_date} 기준 " if target_date else "현재 DB 기준 "
    unassigned = _unassigned_count(all_items)
    lines = [
        f"✅ {when}{member_name}님에게 배정된 {item_label}가 없습니다.",
        f"배정 여부는 assignee_member_id → project_members → users 연결 기준으로 확인했습니다.",
    ]
    if unassigned:
        lines.append(f"참고: 같은 범위에 담당자 미지정 {item_label}가 {unassigned}개 있습니다. 담당자 배정이 누락됐을 수 있습니다.")
    return "\n".join(lines)


def _local_answer(message: str, context: str, team_members: list[str] | None = None) -> str:
    lowered = message.lower()
    sections = _split_context(context)
    member_name = _extract_member_name(message, team_members or [])
    target_date = _extract_date_filter(message)

    if _is_task_lookup_question(message):
        task_answer = _answer_task_lookup(message, sections, team_members)
        if task_answer:
            return task_answer

    if "todo" in lowered or "할 일" in message or "미완료" in message:
        all_todos = sections.get("Todos", [])
        if "완료" in message and "미완료" not in message:
            all_todos = [todo for todo in all_todos if _field(todo, "status") in COMPLETED_TODO_STATUSES]
        else:
            all_todos = [todo for todo in all_todos if _field(todo, "status") in ACTIVE_TODO_STATUSES]
        scoped_todos = _filter_by_date(all_todos, target_date) if target_date else all_todos
        todos = _filter_by_assignee(scoped_todos, member_name) if member_name else scoped_todos

        if not todos:
            when = f"{target_date} 기준 " if target_date else ""
            if member_name:
                return _assignee_empty_message(member_name, "Todo", target_date, scoped_todos)
            return f"✅ {when}등록된 Todo가 없습니다."

        member_prefix = f"**{member_name}님의** " if member_name else ""
        date_prefix = f"{target_date} 등록/마감일 기준 " if target_date else ""
        lines = [f"📋 {date_prefix}{member_prefix}미완료 Todo 목록\n"]
        for todo in todos[:8]:
            parts = todo.lstrip("- ").split(" | ")
            title = parts[0].strip()
            priority = next((p.replace("priority=", "") for p in parts if "priority=" in p), "")
            due = next((p.replace("due=", "") for p in parts if "due=" in p), "")
            priority_icon = "🔴" if priority == "high" else "🟡" if priority == "medium" else "🟢"
            due_str = f" · 마감 {due}" if due and due != "no due date" else ""
            lines.append(f"{priority_icon} {title}{due_str}")
        lines.append(f"\n총 {len(todos)}개 항목")
        return "\n".join(lines)

    if "issue" in lowered or "이슈" in message or "위험" in message or "리스크" in message:
        all_issues = sections.get("Issues", [])
        scoped_issues = _filter_by_date(all_issues, target_date) if target_date else all_issues
        issues = _filter_by_assignee(scoped_issues, member_name) if member_name else scoped_issues

        if not issues:
            when = f"{target_date} 기준 " if target_date else ""
            if member_name:
                return _assignee_empty_message(member_name, "Issue", target_date, scoped_issues)
            return f"✅ {when}등록된 위험 이슈가 없습니다."

        member_prefix = f"**{member_name}님의** " if member_name else ""
        date_prefix = f"{target_date} 등록일 기준 " if target_date else "현재 "
        lines = [f"🚨 {member_prefix}{date_prefix}운영 이슈 현황\n"]
        high, medium, low = [], [], []
        for issue in issues[:8]:
            parts = issue.lstrip("- ").split(" | ")
            title = parts[0].strip()
            severity = next((p.replace("severity=", "") for p in parts if "severity=" in p), "")
            status = next((p.replace("status=", "") for p in parts if "status=" in p), "")
            if severity == "high":
                high.append((title, status))
            elif severity == "medium":
                medium.append((title, status))
            else:
                low.append((title, status))
        if high:
            lines.append("🔴 **High Risk**")
            for title, status in high:
                lines.append(f"  · {title} ({status})")
        if medium:
            lines.append("\n🟡 **Medium Risk**")
            for title, status in medium:
                lines.append(f"  · {title} ({status})")
        if low:
            lines.append("\n🟢 **Low Risk**")
            for title, status in low:
                lines.append(f"  · {title} ({status})")
        return "\n".join(lines)

    if "calendar" in lowered or "일정" in message or "캘린더" in message:
        events = sections.get("Calendar", [])
        member_todos = []
        if member_name:
            events = [event for event in events if member_name in event]
            member_todos = [
                todo for todo in _filter_by_assignee(sections.get("Todos", []), member_name)
                if "status=in_progress" in todo or "status=approved" in todo
            ]
        if target_date:
            events = _filter_by_date(events, target_date)
            member_todos = _filter_by_date(member_todos, target_date)
        if not events and not member_todos:
            when = f"{target_date}에 " if target_date else "현재 "
            owner = f"{member_name}님의 " if member_name else ""
            return f"📅 {when}{owner}등록된 일정 또는 진행 Todo가 없습니다."
        date_prefix = f"{target_date} 시작일 기준 " if target_date else ""
        owner = f"{member_name}님의 " if member_name else ""
        lines = [f"📅 **{date_prefix}{owner}일정 현황**\n"]
        for event in events[:8]:
            lines.append(f"  · {event.lstrip('- ').strip()}")
        if member_todos:
            lines.append("\n📋 진행 Todo와 마감일")
            for todo in member_todos[:8]:
                parts = todo.lstrip("- ").split(" | ")
                title = parts[0].strip()
                due = next((part.replace("due=", "") for part in parts if "due=" in part), "no due date")
                lines.append(f"  · {title} · 마감 {due if due != 'no due date' else '미지정'}")
        return "\n".join(lines)

    if member_name:
        all_todos = sections.get("Todos", [])
        all_issues = sections.get("Issues", [])
        scoped_todos = _filter_by_date(all_todos, target_date) if target_date else all_todos
        scoped_issues = _filter_by_date(all_issues, target_date) if target_date else all_issues
        todos = _filter_by_assignee(scoped_todos, member_name)
        issues = _filter_by_assignee(scoped_issues, member_name)
        active_todos = [todo for todo in todos if _field(todo, "status") in ACTIVE_TODO_STATUSES]
        completed_todos = [todo for todo in todos if _field(todo, "status") in COMPLETED_TODO_STATUSES]

        date_prefix = f"{target_date} 기준 " if target_date else ""
        lines = [f"📊 **{date_prefix}{member_name}님의 업무 현황**\n"]
        lines.append(f"📋 진행 Todo: {len(active_todos)}개")
        lines.append(f"✅ 완료 Todo: {len(completed_todos)}개")
        lines.append(f"🚨 Issue: 총 {len(issues)}개 등록됨")
        high_issues = [issue for issue in issues if "severity=high" in issue]
        if high_issues:
            lines.append(f"⚠️ High Risk 이슈 {len(high_issues)}개 주의 필요")
        if todos:
            lines.append("\n📋 Todo 항목")
            for todo in todos[:5]:
                parts = todo.lstrip("- ").split(" | ")
                title = parts[0].strip()
                priority = next((p.replace("priority=", "") for p in parts if "priority=" in p), "")
                due = next((p.replace("due=", "") for p in parts if "due=" in p), "")
                status = next((p.replace("status=", "") for p in parts if "status=" in p), "")
                due_str = f" · 마감 {due}" if due and due != "no due date" else ""
                priority_str = f" · {priority}" if priority else ""
                lines.append(f"  · {title} · {_status_label(status)}{priority_str}{due_str}")
        if issues:
            lines.append("\n🚨 Issue 항목")
            for issue in issues[:5]:
                parts = issue.lstrip("- ").split(" | ")
                title = parts[0].strip()
                severity = next((p.replace("severity=", "") for p in parts if "severity=" in p), "")
                status = next((p.replace("status=", "") for p in parts if "status=" in p), "")
                lines.append(f"  · {title} · {severity} · {status}")
        if not todos and not issues:
            lines.append("\n현재 DB의 assignee_member_id 배정 기준으로는 해당 담당자에게 연결된 업무가 없습니다.")
            unassigned_todos = _unassigned_count(scoped_todos)
            unassigned_issues = _unassigned_count(scoped_issues)
            if unassigned_todos or unassigned_issues:
                lines.append(f"담당자 미지정 항목은 Todo {unassigned_todos}개, Issue {unassigned_issues}개입니다. 배정 누락 여부를 확인해보세요.")
        return "\n".join(lines)

    todos = sections.get("Todos", [])
    issues = sections.get("Issues", [])
    active_todos = [todo for todo in todos if _field(todo, "status") in ACTIVE_TODO_STATUSES]
    completed_todos = [todo for todo in todos if _field(todo, "status") in COMPLETED_TODO_STATUSES]
    lines = ["📊 **WorkRader 운영 현황 요약**\n"]
    lines.append(f"📋 진행 Todo: {len(active_todos)}개")
    lines.append(f"✅ 완료 Todo: {len(completed_todos)}개")
    lines.append(f"🚨 Issue: 총 {len(issues)}개 등록됨")
    high_issues = [issue for issue in issues if "severity=high" in issue]
    if high_issues:
        lines.append(f"⚠️ High Risk 이슈 {len(high_issues)}개 주의 필요")
    lines.append("\n더 구체적으로 알고 싶으면 '미완료 Todo', '위험 이슈', '일정' 을 물어보세요.")
    return "\n".join(lines)

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
