"""Apply a PostgreSQL SQL file using DATABASE_URL.

Usage:
  python tools/apply_postgresql_sql.py db/schema.v4.postgresql.sql
  python tools/apply_postgresql_sql.py db/migrate.v3_to_v4.postgresql.sql
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from sqlalchemy import create_engine, text


def split_sql(sql: str) -> list[str]:
    statements: list[str] = []
    current: list[str] = []
    in_single_quote = False
    in_double_quote = False
    line_comment = False

    i = 0
    while i < len(sql):
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""

        if line_comment:
            current.append(ch)
            if ch == "\n":
                line_comment = False
            i += 1
            continue

        if not in_single_quote and not in_double_quote and ch == "-" and nxt == "-":
            line_comment = True
            current.append(ch)
            current.append(nxt)
            i += 2
            continue

        if ch == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
        elif ch == '"' and not in_single_quote:
            in_double_quote = not in_double_quote

        if ch == ";" and not in_single_quote and not in_double_quote:
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
        else:
            current.append(ch)

        i += 1

    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sql_file", type=Path)
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set.")

    sql_file = args.sql_file.resolve()
    sql = sql_file.read_text(encoding="utf-8")
    statements = split_sql(sql)

    engine = create_engine(database_url)
    with engine.begin() as conn:
        for index, statement in enumerate(statements, start=1):
            conn.execute(text(statement))
            print(f"applied {index}/{len(statements)}")

    print(f"done: {sql_file}")


if __name__ == "__main__":
    main()
