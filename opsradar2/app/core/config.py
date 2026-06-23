"""Application settings.

Keep this lightweight so local harness runs do not require extra settings
packages before the API can boot.
"""

import os
from pathlib import Path
from dataclasses import dataclass

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv()


def parse_csv_env(name: str, default: str) -> tuple[str, ...]:
    raw = os.getenv(name, default)
    return tuple(item.strip() for item in raw.split(",") if item.strip())


def parse_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    return int(raw)


@dataclass(frozen=True)
class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:password@localhost:5432/opsradar",
    )
    DB_SCHEMA: str = os.getenv("DB_SCHEMA", "opsradar2")
    FRONTEND_ORIGINS: tuple[str, ...] = parse_csv_env(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:8002,http://localhost:8002,http://127.0.0.1:8010,http://localhost:8010,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3001,http://localhost:3001",
    )
    MAX_UPLOAD_BYTES: int = parse_int_env("MAX_UPLOAD_BYTES", 25 * 1024 * 1024)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "disabled")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "")
    AZURE_OPENAI_CHAT_DEPLOYMENT: str = os.getenv(
        "AZURE_OPENAI_CHAT_DEPLOYMENT",
        os.getenv("AZURE_OPENAI_DEPLOYMENT", ""),
    )
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT: str = os.getenv(
        "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
        "",
    )
    EMBEDDING_DIMENSION: int = parse_int_env("EMBEDDING_DIMENSION", 1536)
    EMBEDDING_BATCH_SIZE: int = parse_int_env("EMBEDDING_BATCH_SIZE", 16)
    AZURE_OPENAI_MAX_RETRIES: int = parse_int_env("AZURE_OPENAI_MAX_RETRIES", 3)
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "change-this-secret-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = parse_int_env("JWT_EXPIRE_HOURS", 8)
    # Telegram bot (프로토타입). 비어 있으면 폴링 스크립트가 비활성 처리한다.
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")


settings = Settings()
