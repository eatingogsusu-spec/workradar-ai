# OpsRadar2 DB Setup Guide

This guide explains how to reset and seed the `opsradar2` schema in `azag_db`.

## Goal

Use one stable DB baseline for frontend/backend development.

The reset seed creates:

- Latest `opsradar2` tables from `schema.sql`
- Korean dummy documents, chunks, todos, issues, reports, chat messages, and AI summaries
- Demo-ready data that looks like upload + AI analysis has already completed

## Important Rules

Do not use `public` tables for OpsRadar2 development.

Always use:

```sql
opsradar2.todos
opsradar2.issues
opsradar2.documents
```

Instead of:

```sql
todos
issues
documents
```

Column names must follow the latest schema:

- Use `due_at`, not `due_date`
- Use `uploaded_by_member_id`, not `uploaded_by`
- Use `assignee_member_id`, not `assignee_id`
- Use `created_by_member_id`, not `created_by`

## Files

Main files:

```text
opsradar2/schema.sql
opsradar2/dummy_data_latest_seed.sql
opsradar2/dbeaver_reset_and_seed.sql
```

Recommended file for DBeaver:

```text
opsradar2/dbeaver_reset_and_seed.sql
```

That file does everything:

1. Drops the old `opsradar2` schema
2. Creates the latest schema
3. Inserts Korean dummy data

## DBeaver Setup

Before running the seed, set DBeaver encoding:

1. Open `Window > Preferences`
2. Go to `General > Workspace`
3. Set `Text file encoding` to `UTF-8`
4. Reopen the SQL file after changing this setting

## DBeaver Reset And Seed

Open this file in DBeaver:

```text
C:\Users\wndnj\teamAZAG-1\opsradar2\dbeaver_reset_and_seed.sql
```

Run it with:

```text
Alt + X
```

Use `Execute SQL Script`.

Do not use `Ctrl + Enter` for this file. `Ctrl + Enter` can execute only the current SQL block and may leave the DB half-created.

## Expected Counts

After running the reset seed, run:

```sql
SELECT
  (SELECT COUNT(*) FROM opsradar2.documents) AS documents,
  (SELECT COUNT(*) FROM opsradar2.document_chunks) AS document_chunks,
  (SELECT COUNT(*) FROM opsradar2.todos) AS todos,
  (SELECT COUNT(*) FROM opsradar2.issues) AS issues,
  (SELECT COUNT(*) FROM opsradar2.chat_messages) AS chat_messages,
  (SELECT COUNT(*) FROM opsradar2.ai_summaries) AS ai_summaries;
```

Expected result:

```text
documents        5
document_chunks 8
todos           8
issues          5
chat_messages   6
ai_summaries    2
```

## Korean Content Check

Run:

```sql
SELECT 'user' AS type, name AS sample
FROM opsradar2.users
WHERE email = 'heejin@azag.dev'

UNION ALL

SELECT 'chunk', content
FROM opsradar2.document_chunks
WHERE id = 'f0000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 'todo', title
FROM opsradar2.todos
WHERE id = '70000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 'issue', title
FROM opsradar2.issues
WHERE id = '80000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 'weekly_report', LEFT(content, 120)
FROM opsradar2.weekly_reports
WHERE id = '90000000-0000-0000-0000-000000000002'

UNION ALL

SELECT 'chat', content
FROM opsradar2.chat_messages
WHERE id = '93000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 'ai_summary', summary
FROM opsradar2.ai_summaries
WHERE id = '94000000-0000-0000-0000-000000000001';
```

You should see Korean text such as:

```text
김희진
킥오프 회의
Azure OpenAI API 타임아웃
2주차 운영 보고서
현재 가장 위험한 이슈는?
```

## Safer Python Reset

If DBeaver encoding causes broken Korean text, run the Python reset script instead.

From PowerShell:

```powershell
cd C:\Users\wndnj\teamAZAG-1\opsradar2
.\venv\Scripts\python.exe C:\Users\wndnj\OneDrive\문서\인수인계\scripts\apply_dbeaver_reset_and_seed.py
```

This reads SQL as UTF-8 and is safer than copying long Korean SQL into DBeaver.

## Common Errors

### `relation "opsradar2.todos" does not exist`

Cause:

The schema creation stopped halfway, usually because `Ctrl + Enter` was used instead of full script execution.

Fix:

Run `dbeaver_reset_and_seed.sql` again with `Alt + X`.

### `column "uploaded_by_member_id" does not exist`

Cause:

The old DB schema is still present.

Fix:

Run the full reset seed:

```text
opsradar2/dbeaver_reset_and_seed.sql
```

### Counts show `documents = 0` but `todos` has many rows

Cause:

You are probably checking `public.todos`, not `opsradar2.todos`.

Fix:

Always use schema-qualified names:

```sql
SELECT * FROM opsradar2.todos;
```

## Upload Flow Vs Seed Data

The seed data is demo data. It is not the same as a real upload flow.

Real flow:

```text
File upload
-> documents row created
-> file parsed
-> document_chunks created
-> AI analyzes chunks
-> Todo/Issue/Calendar/Report candidates created
-> user approves candidates
-> final rows appear in todos/issues/calendar_events/reports
```

The seed file already inserts the final demo result, so frontend screens can be tested immediately.

Frontend should not assume that uploading a file immediately creates confirmed todos or issues. It should support document status and candidate approval flow.

## Backend Environment

Backend should use:

```env
DB_SCHEMA=opsradar2
```

When writing SQL, prefer:

```sql
SET search_path TO opsradar2, public;
```

or explicit table names:

```sql
opsradar2.todos
opsradar2.issues
```
