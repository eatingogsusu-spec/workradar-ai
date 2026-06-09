"""Back up and repair mojibake Korean text in user-visible DB columns.

Usage:
  python scripts/repair_mojibake_text.py --dry-run
  python scripts/repair_mojibake_text.py --apply
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.database import AsyncSessionLocal, engine


CANDIDATE_COLUMNS = {
    "ai_summaries": ["summary"],
    "chat_messages": ["content"],
    "document_chunks": ["content", "section_title"],
    "documents": ["file_name", "error_message"],
    "embedding_jobs": ["error_message"],
    "handoff_reports": ["content"],
    "issue_history": ["note"],
    "issues": ["title", "description", "risk_reason", "domino_chain"],
    "monthly_reports": ["content"],
    "projects": ["name", "description"],
    "todos": ["title", "description"],
    "weekly_reports": ["content"],
}

MOJIBAKE_RE = re.compile(r"[ÂÃ]|[ìíëê][\x80-\xff]|â[\x80-\xff]")
HANGUL_RE = re.compile(r"[\uac00-\ud7a3]")


def looks_mojibake(value: str) -> bool:
    return bool(MOJIBAKE_RE.search(value))


def readability_score(value: str) -> int:
    score = len(HANGUL_RE.findall(value)) * 4
    score -= len(MOJIBAKE_RE.findall(value)) * 6
    score -= sum(1 for char in value if "\x80" <= char <= "\x9f") * 8
    return score


def repair_text(value: str) -> str:
    if not looks_mojibake(value):
        return value

    candidates = [value]
    for encoding in ("latin1", "cp1252"):
        try:
            candidates.append(value.encode(encoding).decode("utf-8"))
        except UnicodeError:
            pass

    return max(candidates, key=readability_score)


def shorten(value: str, limit: int = 120) -> str:
    compact = " ".join(value.split())
    return compact if len(compact) <= limit else f"{compact[:limit]}..."


async def table_exists(session, table: str) -> bool:
    result = await session.execute(
        text(
            """
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = current_schema()
                AND table_name = :table
            )
            """
        ),
        {"table": table},
    )
    return bool(result.scalar_one())


async def collect_changes(session) -> list[dict]:
    changes: list[dict] = []
    for table, columns in CANDIDATE_COLUMNS.items():
        if not await table_exists(session, table):
            continue

        column_sql = ", ".join(f'"{column}"' for column in columns)
        rows = (
            await session.execute(text(f'SELECT id::text AS id, {column_sql} FROM "{table}"'))
        ).mappings().all()

        for row in rows:
            updates = {}
            originals = {}
            for column in columns:
                original = row[column]
                if not isinstance(original, str) or not looks_mojibake(original):
                    continue
                repaired = repair_text(original)
                if repaired != original and readability_score(repaired) > readability_score(original):
                    originals[column] = original
                    updates[column] = repaired
            if updates:
                changes.append(
                    {
                        "table": table,
                        "id": row["id"],
                        "originals": originals,
                        "updates": updates,
                    }
                )
    return changes


async def write_backup(changes: list[dict]) -> Path:
    backup_dir = ROOT / "backups"
    backup_dir.mkdir(exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"mojibake_text_backup_{timestamp}.json"
    backup_path.write_text(
        json.dumps(
            {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "change_count": len(changes),
                "changes": changes,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return backup_path


async def apply_changes(session, changes: list[dict]) -> None:
    for change in changes:
        assignments = ", ".join(f'"{column}" = :{column}' for column in change["updates"])
        params = {"id": change["id"], **change["updates"]}
        await session.execute(
            text(f'UPDATE "{change["table"]}" SET {assignments} WHERE id = CAST(:id AS uuid)'),
            params,
        )
    await session.commit()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write repaired text back to the DB")
    parser.add_argument("--dry-run", action="store_true", help="only print planned changes")
    args = parser.parse_args()

    if args.apply == args.dry_run:
        raise SystemExit("choose exactly one: --dry-run or --apply")

    async with AsyncSessionLocal() as session:
        changes = await collect_changes(session)
        backup_path = await write_backup(changes)

        print(f"backup={backup_path}")
        print(f"candidate_rows={len(changes)}")
        for change in changes[:20]:
            columns = ", ".join(change["updates"].keys())
            print(f"- {change['table']} {change['id']} [{columns}]")
            for column, original in change["originals"].items():
                repaired = change["updates"][column]
                print(f"  {column}.before={shorten(original)}")
                print(f"  {column}.after ={shorten(repaired)}")

        if args.apply:
            await apply_changes(session, changes)
            print(f"updated_rows={len(changes)}")
        else:
            print("updated_rows=0")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
