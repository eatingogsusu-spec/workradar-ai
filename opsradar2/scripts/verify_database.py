"""Verify the configured PostgreSQL database and OpsRadar schema."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.core.database import engine


EXPECTED_TABLES = {
    "ai_summaries",
    "calendar_events",
    "chat_messages",
    "chunk_embeddings",
    "document_chunks",
    "documents",
    "embedding_jobs",
    "faiss_indexes",
    "handoff_reports",
    "issue_history",
    "issues",
    "monthly_reports",
    "project_members",
    "projects",
    "teams",
    "todos",
    "users",
    "weekly_reports",
}


async def main() -> None:
    async with engine.connect() as connection:
        identity = (
            await connection.execute(
                text(
                    """
                    SELECT
                      current_database() AS database,
                      current_user AS username,
                      current_schema() AS schema
                    """
                )
            )
        ).mappings().one()
        search_path = (await connection.execute(text("SHOW search_path"))).scalar_one()
        tables = {
            row[0]
            for row in (
                await connection.execute(
                    text(
                        """
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = :schema
                        ORDER BY table_name
                        """
                    ),
                    {"schema": settings.DB_SCHEMA},
                )
            ).all()
        }

    await engine.dispose()

    missing_tables = sorted(EXPECTED_TABLES - tables)
    extra_tables = sorted(tables - EXPECTED_TABLES)

    print(f"database={identity['database']}")
    print(f"user={identity['username']}")
    print(f"search_path={search_path}")
    print(f"current_schema={identity['schema']}")
    print(f"table_count={len(tables)}")
    print(f"missing_tables={','.join(missing_tables) or '<none>'}")
    print(f"extra_tables={','.join(extra_tables) or '<none>'}")

    if identity["schema"] != settings.DB_SCHEMA or missing_tables:
        raise SystemExit("database schema verification failed")


if __name__ == "__main__":
    asyncio.run(main())
