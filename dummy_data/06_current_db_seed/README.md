# OpsRadar2 Current DB Seed

This seed matches `opsradar2/schema.sql` from `SeongWoo-new2` (plus optional auth migration columns left to database defaults).

## Row counts
- `teams.csv`: 1 rows
- `users.csv`: 8 rows
- `projects.csv`: 1 rows
- `project_members.csv`: 8 rows
- `documents.csv`: 88 rows
- `issues.csv`: 15 rows
- `todos.csv`: 45 rows
- `calendar_events.csv`: 45 rows
- `weekly_reports.csv`: 3 rows
- `monthly_reports.csv`: 2 rows
- `handoff_reports.csv`: 2 rows
- `chat_messages.csv`: 9 rows
- `ai_summaries.csv`: 15 rows

## Generate and validate
```bash
python scripts/create_current_db_seed.py
python scripts/validate_current_db_seed.py
```

## Load
```bash
psql -h 127.0.0.1 -p 5432 -U postgres -d azag_db -f dummy_data/06_current_db_seed/sql/insert_current_seed.sql
```

All identifiers are deterministic UUIDs. The SQL sets `search_path` to `opsradar2, public`. Expected-output samples and `05_db_seed_v2` are not loaded.
