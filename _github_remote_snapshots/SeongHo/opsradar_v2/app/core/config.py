from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "OpsRadar"
    API_VERSION: str = "0.1.0"
    API_PREFIX: str = "/api/v1"

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "opsradar"
    POSTGRES_USER: str = "opsradar"
    POSTGRES_PASSWORD: str = "opsradar"
    DATABASE_URL: str | None = None

    FAISS_DATA_DIR: Path = Path("data/faiss")
    AI_PROVIDER: str = Field(default="azure_openai", pattern="^(azure_openai|gemini|mock)$")
    AZURE_OPENAI_ENDPOINT: str | None = None
    AZURE_OPENAI_API_KEY: str | None = None
    AZURE_OPENAI_DEPLOYMENT: str | None = None
    GEMINI_API_KEY: str | None = None

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    SECRET_KEY: str = "change-me"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
