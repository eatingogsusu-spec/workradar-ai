"""Seed local login credentials for the dummy users (DEV/DEMO ONLY).

Sets username (= email local part) and a bcrypt password_hash on every existing user,
and creates the admin account. Passwords are hashed with app.core.security.hash_password.

The default password is intentionally trivial and this must never be run against a real
environment; it is guarded to the dummy @autopartsone.kr accounts on localhost.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password

DEFAULT_PASSWORD = "password123"
EMAIL_DOMAIN = "autopartsone.kr"

ADMIN_EMAIL = f"admin@{EMAIL_DOMAIN}"
ADMIN_NAME = "관리자"
DEMO_PROJECT_ID = "0a4f9295-ac96-59f7-b09d-fb82f68610c8"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="Plaintext password to set.")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply changes. Without this flag, only report what would change.",
    )
    return parser.parse_args()


async def seed(args: argparse.Namespace) -> int:
    if "localhost" not in settings.DATABASE_URL and "127.0.0.1" not in settings.DATABASE_URL:
        raise RuntimeError("refusing to seed demo passwords into a non-local database")

    async with AsyncSessionLocal() as db:
        existing = (
            await db.execute(
                text(
                    """
                    SELECT email, team_id
                    FROM users
                    WHERE email LIKE :domain AND deleted_at IS NULL
                    ORDER BY email
                    """
                ),
                {"domain": f"%@{EMAIL_DOMAIN}"},
            )
        ).mappings().all()

        print(f"Users to receive credentials: {len(existing)}")
        for row in existing:
            print(f"  {row['email']} -> username={row['email'].split('@')[0]}")
        admin_exists = any(row["email"] == ADMIN_EMAIL for row in existing)
        print(f"Admin account {ADMIN_EMAIL}: {'exists' if admin_exists else 'will be created'}")

        if not args.execute:
            print("\nDry run. Re-run with --execute to apply.")
            return 0

        # Reuse the team the demo users already belong to, so admin lands in the same org.
        team_id = next((row["team_id"] for row in existing if row["team_id"]), None)

        # bcrypt salts per row, so each hash is generated individually rather than in SQL.
        admin_id = (
            await db.execute(
                text(
                    """
                    INSERT INTO users (name, email, username, password_hash, role, team_id, status)
                    VALUES (:name, :email, :username, :password_hash, 'admin', :team_id, 'active')
                    ON CONFLICT (email) DO UPDATE SET
                        username = EXCLUDED.username,
                        password_hash = EXCLUDED.password_hash,
                        role = 'admin',
                        updated_at = now()
                    RETURNING id
                    """
                ),
                {
                    "name": ADMIN_NAME,
                    "email": ADMIN_EMAIL,
                    "username": ADMIN_EMAIL.split("@")[0],
                    "password_hash": hash_password(args.password),
                    "team_id": team_id,
                },
            )
        ).scalar_one()

        # Without a project_members row the admin cannot see the demo project's data,
        # since documents/todos/issues are all scoped through membership.
        await db.execute(
            text(
                """
                INSERT INTO project_members (team_id, project_id, user_id, role, status)
                VALUES (:team_id, :project_id, :user_id, 'admin', 'active')
                ON CONFLICT (project_id, user_id) DO UPDATE SET
                    role = 'admin',
                    status = 'active'
                """
            ),
            {
                "team_id": team_id,
                "project_id": DEMO_PROJECT_ID,
                "user_id": admin_id,
            },
        )

        for row in existing:
            if row["email"] == ADMIN_EMAIL:
                continue
            await db.execute(
                text(
                    """
                    UPDATE users
                    SET username = :username,
                        password_hash = :password_hash,
                        updated_at = now()
                    WHERE email = :email
                    """
                ),
                {
                    "email": row["email"],
                    "username": row["email"].split("@")[0],
                    "password_hash": hash_password(args.password),
                },
            )

        await db.commit()

    print(f"\nDone. Password set to: {args.password!r} (dev only)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(seed(parse_args())))
