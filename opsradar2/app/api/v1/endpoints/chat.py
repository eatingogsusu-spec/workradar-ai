"""UC-07 AI assistant endpoints."""

from __future__ import annotations

import re
from datetime import date
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

# 팀원 이름 목록
TEAM_MEMBERS = ["이성우", "김희진", "박주원", "김성호", "김예은"]


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
        "todo", "issue", "calendar",
        "할 일", "미완료", "이슈", "위험", "리스크", "일정", "캘린더",
        "업무", "담당", "알려줘", "뭐야", "현황", "요약",
    )
    return any(token in lowered or token in message for token in tokens)


def _extract_member_name(message: str) -> str | None:
    """질문에서 팀원 이름 추출"""
    for member in TEAM_MEMBERS:
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


def _local_answer(message: str, context: str) -> str:
    lowered = message.lower()
    sections = _split_context(context)
    member_name = _extract_member_name(message)
    target_date = _extract_date_filter(message)

    if "todo" in lowered or "할 일" in message or "미완료" in message:
        all_todos = sections.get("Todos", [])
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
        if target_date:
            events = _filter_by_date(events, target_date)
        if not events:
            when = f"{target_date}에 " if target_date else "현재 "
            return f"📅 {when}등록된 일정이 없습니다."
        date_prefix = f"{target_date} 시작일 기준 " if target_date else ""
        lines = [f"📅 **{date_prefix}일정 현황**\n"]
        for event in events[:8]:
            lines.append(f"  · {event.lstrip('- ').strip()}")
        return "\n".join(lines)

    if member_name:
        all_todos = sections.get("Todos", [])
        all_issues = sections.get("Issues", [])
        scoped_todos = _filter_by_date(all_todos, target_date) if target_date else all_todos
        scoped_issues = _filter_by_date(all_issues, target_date) if target_date else all_issues
        todos = _filter_by_assignee(scoped_todos, member_name)
        issues = _filter_by_assignee(scoped_issues, member_name)

        date_prefix = f"{target_date} 기준 " if target_date else ""
        lines = [f"📊 **{date_prefix}{member_name}님의 업무 현황**\n"]
        lines.append(f"📋 Todo: 총 {len(todos)}개 진행 중")
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
                due_str = f" · 마감 {due}" if due and due != "no due date" else ""
                priority_str = f" · {priority}" if priority else ""
                lines.append(f"  · {title}{priority_str}{due_str}")
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
    lines = ["📊 **OpsRadar 운영 현황 요약**\n"]
    lines.append(f"📋 Todo: 총 {len(todos)}개 진행 중")
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
