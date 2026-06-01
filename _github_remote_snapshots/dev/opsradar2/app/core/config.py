from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DB
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/opsradar"

    # AI Provider (azure | gemini)
    AI_PROVIDER: str = "gemini"
    GEMINI_API_KEY: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_DEPLOYMENT: str = ""

    # Vector DB
    FAISS_INDEX_PATH: str = "data/faiss/index.faiss"

    class Config:
        env_file = ".env"


settings = Settings()
