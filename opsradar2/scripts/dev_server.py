"""Local development server runner with clearer shutdown diagnostics."""

from __future__ import annotations

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


if __name__ == "__main__":
    config = uvicorn.Config(
        "app.main:app",
        host="127.0.0.1",
        port=8010,
        log_level="info",
    )
    DiagnosticServer(config).run()
