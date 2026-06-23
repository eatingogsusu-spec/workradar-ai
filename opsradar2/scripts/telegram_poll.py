"""텔레그램 getUpdates 폴링 진입점 (프로토타입, 독립 실행).

실행:  python scripts/telegram_poll.py

- TELEGRAM_BOT_TOKEN(opsradar2/.env)이 비어 있으면 안내 후 종료(앱/서버 영향 0).
- 새 텍스트 메시지를 받아 ingest_telegram_message 로 기존 문서 파이프라인에 흘려보낸다.
- offset(마지막 처리 update_id+1)은 scripts/.telegram_offset 에 보관해 재처리를 막는다(D3).
- 앱 서버와 별개 프로세스로 동작한다(D4) — 발표본/기동에 끼어들지 않는다.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.integrations.telegram.client import TelegramClient, TelegramError  # noqa: E402
from app.integrations.telegram.ingest import ingest_telegram_message  # noqa: E402

OFFSET_FILE = Path(__file__).with_name(".telegram_offset")
LONG_POLL_TIMEOUT = 30
ERROR_BACKOFF_SECONDS = 5


def _read_offset() -> int | None:
    try:
        return int(OFFSET_FILE.read_text().strip())
    except (FileNotFoundError, ValueError):
        return None


def _write_offset(offset: int) -> None:
    try:
        OFFSET_FILE.write_text(str(offset))
    except OSError as exc:
        print(f"[warn] offset 저장 실패: {exc}")


async def _handle_update(update: dict) -> None:
    """단일 update를 ingest. 실패해도 예외를 삼켜 폴링 루프를 죽이지 않는다."""
    async with AsyncSessionLocal() as db:
        try:
            document = await ingest_telegram_message(db, update)
        except Exception as exc:  # noqa: BLE001 - 한 메시지 실패가 루프를 멈추면 안 됨
            await db.rollback()
            print(f"[error] ingest 실패 (update_id={update.get('update_id')}): {exc}")
            return
    if document is not None:
        print(f"[ingest] document={document.id} file={document.file_name}")
    else:
        print(f"[skip] update_id={update.get('update_id')} (D5 필터/비텍스트)")


async def main() -> None:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        print(
            "TELEGRAM_BOT_TOKEN 이 비어 있습니다. "
            "opsradar2/.env 에 토큰을 넣고 다시 실행하세요. (비활성 종료)"
        )
        return

    client = TelegramClient(token)
    try:
        me = await asyncio.to_thread(client.get_me)
        print(f"봇 연결됨: @{me.get('username')} (id={me.get('id')})")
    except TelegramError as exc:
        print(f"[fatal] 토큰 확인 실패: {exc}")
        return

    offset = _read_offset()
    print(f"폴링 시작 (offset={offset}). 종료하려면 Ctrl+C")
    while True:
        try:
            # 블로킹 롱폴(urllib)은 스레드로 빼 이벤트 루프를 막지 않는다.
            updates = await asyncio.to_thread(client.get_updates, offset, LONG_POLL_TIMEOUT)
        except TelegramError as exc:
            print(f"[warn] getUpdates 실패: {exc} — {ERROR_BACKOFF_SECONDS}s 후 재시도")
            await asyncio.sleep(ERROR_BACKOFF_SECONDS)
            continue

        for update in updates:
            await _handle_update(update)
            update_id = update.get("update_id")
            if isinstance(update_id, int):
                # 처리/스킵/실패 무관하게 전진 → poison 메시지로 인한 무한 재처리 방지.
                offset = update_id + 1
                _write_offset(offset)


if __name__ == "__main__":
    # asyncpg 안정성을 위해 Windows에서는 Selector 루프 사용(dev_server.py와 동일 의도).
    if sys.platform.startswith("win") and hasattr(asyncio, "WindowsSelectorEventLoopPolicy"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n중단됨.")
