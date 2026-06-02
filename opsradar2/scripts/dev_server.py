"""Local development server runner with clearer shutdown diagnostics."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from types import FrameType

import uvicorn
from uvicorn.server import Server

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class DiagnosticServer(Server):
    def handle_exit(self, sig: int, frame: FrameType | None) -> None:
        print(f"Received shutdown signal: {sig}", flush=True)
        super().handle_exit(sig, frame)


def selector_loop_factory() -> asyncio.AbstractEventLoop:
    return asyncio.SelectorEventLoop()


if __name__ == "__main__":
    supports_loop_factory = hasattr(uvicorn.Config, "get_loop_factory")
    if (
        sys.platform.startswith("win")
        and not supports_loop_factory
        and hasattr(asyncio, "WindowsSelectorEventLoopPolicy")
    ):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    config = uvicorn.Config(
        "app.main:app",
        host="127.0.0.1",
        port=8010,
        log_level="info",
        loop=(
            selector_loop_factory
            if sys.platform.startswith("win") and supports_loop_factory
            else "asyncio"
        ),
    )
    DiagnosticServer(config).run()
