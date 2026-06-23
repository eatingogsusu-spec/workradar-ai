"""텔레그램 메시지 → 기존 문서 파이프라인 브리지 (프로토타입).

D1: 텍스트→.txt 우회. 정규화된 메시지를 .txt로 저장하고 Document(file_type='chat')를
만든 뒤 run_document_pipeline 을 그대로 호출한다.

기존 추출 로직(_create_extracted_items: is_candidate=true, approval_status=pending)은
절대 건드리지 않고 그대로 재사용한다 — 이 모듈은 "입구"만 추가한다.

Document 모델에 source 컬럼이 없어, 텔레그램 출처는 file_name 접두사(telegram_...)와
.txt 본문의 메타데이터 헤더([출처: 텔레그램])로 인코딩한다(AI 추출 컨텍스트에도 포함).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.services.document_service import (
    UPLOAD_DIR,
    normalize_db_file_type,
    resolve_project_id,
    run_document_pipeline,
)

# D5: 본문 최소 길이(공백 제거 후). 너무 짧은 잡담/리액션 제외.
MIN_TEXT_LENGTH = 10


def normalize_update(update: dict[str, Any]) -> dict[str, Any] | None:
    """텔레그램 update → {text, meta}. message가 아니거나 텍스트가 없으면(사진 등) None.

    meta = {from, from_is_bot, chat_id, message_id, date}
    """
    message = update.get("message")
    if not isinstance(message, dict):
        return None
    text = message.get("text")
    if not isinstance(text, str):  # D5: 텍스트 아닌 것(사진/스티커/문서 등) 제외
        return None
    frm = message.get("from") or {}
    chat = message.get("chat") or {}
    return {
        "text": text,
        "meta": {
            "from": _format_from(frm),
            "from_is_bot": bool(frm.get("is_bot")),
            "chat_id": chat.get("id"),
            "message_id": message.get("message_id"),
            "date": message.get("date"),
        },
    }


def should_ingest(normalized: dict[str, Any]) -> tuple[bool, str]:
    """D5 필터. (수용 여부, 사유). 사유는 호출자 로깅용."""
    meta = normalized["meta"]
    text = normalized["text"].strip()
    if meta.get("from_is_bot"):
        return False, "bot 메시지"  # 봇 자신/타 봇 — sendMessage 무한루프 방지
    if text.startswith("/"):
        return False, "명령어(/)"
    if len(text) < MIN_TEXT_LENGTH:
        return False, f"최소 길이({MIN_TEXT_LENGTH}) 미만"
    return True, "ok"


async def ingest_telegram_message(db: AsyncSession, update: dict[str, Any]) -> Document | None:
    """update를 정규화·필터링 후 통과하면 Document 생성 + 파이프라인 실행. 제외 시 None.

    db: 호출자가 연 AsyncSession(Document 생성/커밋용). run_document_pipeline은
        내부에서 자체 세션을 열므로, 여기서 먼저 커밋해 가시성을 보장한다.
    """
    normalized = normalize_update(update)
    if normalized is None:
        return None
    accepted, _reason = should_ingest(normalized)
    if not accepted:
        return None

    meta = normalized["meta"]
    document_id = uuid.uuid4()
    file_name = f"telegram_{meta.get('chat_id')}_{meta.get('message_id')}.txt"
    save_path = UPLOAD_DIR / f"{document_id}_{file_name}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    save_path.write_text(_build_document_text(normalized), encoding="utf-8")

    project_id = await resolve_project_id(db, None)  # D2: 기본 프로젝트
    document = Document(
        id=document_id,
        project_id=project_id,
        uploaded_by_member_id=None,  # D2: 텔레그램 사용자↔member 매핑은 후속 작업
        file_name=file_name,
        file_type=normalize_db_file_type("chat", file_name),
        mime_type="text/plain",
        storage_uri=str(save_path),
        analysis_status="uploaded",
        progress=0,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    # 기존 파이프라인 그대로 호출(parse→chunk→embed→extract). 추출 로직 무수정 재사용.
    await run_document_pipeline(str(document.id))
    return document


def _build_document_text(normalized: dict[str, Any]) -> str:
    """메타데이터 헤더 + 본문. 헤더는 AI 추출이 출처/맥락을 인지하도록 포함한다."""
    meta = normalized["meta"]
    header = (
        "[출처: 텔레그램]\n"
        f"보낸이: {meta.get('from')}\n"
        f"채팅 ID: {meta.get('chat_id')}\n"
        f"메시지 ID: {meta.get('message_id')}\n"
        f"시각: {_format_date(meta.get('date'))}\n"
        "---\n"
    )
    return header + normalized["text"].strip() + "\n"


def _format_from(frm: dict[str, Any]) -> str:
    """from 객체 → 표시 이름(이름 + @username, 없으면 id)."""
    name = " ".join(p for p in (frm.get("first_name"), frm.get("last_name")) if p).strip()
    username = frm.get("username")
    if username:
        name = f"{name} (@{username})" if name else f"@{username}"
    return name or str(frm.get("id") or "unknown")


def _format_date(ts: Any) -> str:
    """텔레그램 date(Unix epoch) → ISO 문자열."""
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()
    except (TypeError, ValueError):
        return str(ts or "")
