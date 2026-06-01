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


@dataclass(frozen=True)
class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:password@localhost:5432/opsradar",
    )
    DB_SCHEMA: str = os.getenv("DB_SCHEMA", "public")
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
    FAISS_INDEX_PATH: str = os.getenv("FAISS_INDEX_PATH", "data/faiss/index.faiss")


settings = Settings()
