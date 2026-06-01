"""
PostgreSQL 연결 설정 (SQLAlchemy 비동기)
담당: 김성호
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI dependency — 비동기 DB 세션 주입"""
    async with AsyncSessionLocal() as session:
        yield session
