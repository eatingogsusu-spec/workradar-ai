"""Allow review items to be marked as needing revision.

This keeps the existing approval_status workflow and only expands the DB
check constraints to accept the MVP review state used by the frontend.
"""

import asyncio

from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal


TABLES = ("todos", "issues")
ALLOWED = ("pending", "approved", "rejected", "needs_revision")


async def main() -> None:
    allowed_sql = ", ".join(f"'{value}'" for value in ALLOWED)
    async with AsyncSessionLocal() as session:
        for table in TABLES:
            constraint_name = f"{table}_approval_status_check"
            await session.execute(
                text(
                    f"""
                    ALTER TABLE {settings.DB_SCHEMA}.{table}
                    DROP CONSTRAINT IF EXISTS {constraint_name}
                    """
                )
            )
            await session.execute(
                text(
                    f"""
                    ALTER TABLE {settings.DB_SCHEMA}.{table}
                    ADD CONSTRAINT {constraint_name}
                    CHECK (approval_status IN ({allowed_sql}))
                    """
                )
            )
        await session.commit()
    print("approval_status now allows: " + ", ".join(ALLOWED))


if __name__ == "__main__":
    asyncio.run(main())
