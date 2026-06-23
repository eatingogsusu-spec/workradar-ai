"""Telegram Bot API 클라이언트 (프로토타입).

전송(transport)만 담당한다: getUpdates 롱폴링과 토큰 검증용 getMe.
의존성 0 추가를 위해 표준 라이브러리(urllib)만 사용한다(도커 안전).
메시지 필터링(is_bot / '/' 명령 / 텍스트·길이)은 상위(ingest/poll)에서 처리한다.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


class TelegramError(RuntimeError):
    """Telegram API가 ok=false를 반환하거나 전송이 실패했을 때."""


class TelegramClient:
    """단일 봇 토큰에 대한 얇은 Bot API 래퍼."""

    def __init__(self, token: str, base_url: str = "https://api.telegram.org") -> None:
        if not token:
            raise TelegramError("TELEGRAM_BOT_TOKEN이 비어 있습니다.")
        self._token = token
        self._base = f"{base_url.rstrip('/')}/bot{token}"

    def _request(self, method: str, params: dict[str, Any], timeout: float) -> Any:
        """GET {base}/{method}?params 호출 후 result를 반환. ok=false면 TelegramError."""
        query = urllib.parse.urlencode(
            {k: v for k, v in params.items() if v is not None}
        )
        url = f"{self._base}/{method}"
        if query:
            url = f"{url}?{query}"
        req = urllib.request.Request(url, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # Telegram은 4xx에도 JSON 본문(description)을 준다. 가능하면 그걸 노출.
            body = exc.read().decode("utf-8", "replace") if exc.fp else ""
            raise TelegramError(f"{method} HTTP {exc.code}: {body or exc.reason}") from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise TelegramError(f"{method} 전송 실패: {exc}") from exc

        if not isinstance(payload, dict) or not payload.get("ok"):
            desc = payload.get("description") if isinstance(payload, dict) else payload
            raise TelegramError(f"{method} 응답 ok=false: {desc}")
        return payload.get("result")

    def get_me(self) -> dict[str, Any]:
        """봇 정체 확인(토큰 유효성 점검 + self-filter용 봇 id/username)."""
        return self._request("getMe", {}, timeout=10)

    def get_updates(
        self,
        offset: int | None = None,
        timeout: int = 30,
        allowed_updates: tuple[str, ...] = ("message",),
    ) -> list[dict[str, Any]]:
        """롱폴링으로 새 업데이트를 가져온다.

        offset: 마지막으로 처리한 update_id + 1 (이전 업데이트 확인 처리).
        timeout: 서버 측 롱폴 대기 시간(초). 소켓 타임아웃은 +10초로 둔다.
        allowed_updates: 'message'만 받아 노이즈를 줄인다.
        """
        params: dict[str, Any] = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset
        if allowed_updates:
            params["allowed_updates"] = json.dumps(list(allowed_updates))
        result = self._request("getUpdates", params, timeout=timeout + 10)
        return result if isinstance(result, list) else []
