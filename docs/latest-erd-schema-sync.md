# Latest ERD Schema Sync

The `dev` branch ERD review and the deployable OpsRadar 2 schema both define
the same 18 application tables. For the deployable application, the executable
source of truth is `opsradar2/schema.sql`.

## Tables

- `teams`
- `users`
- `projects`
- `project_members`
- `documents`
- `document_chunks`
- `faiss_indexes`
- `chunk_embeddings`
- `embedding_jobs`
- `todos`
- `issues`
- `issue_history`
- `calendar_events`
- `weekly_reports`
- `monthly_reports`
- `handoff_reports`
- `chat_messages`
- `ai_summaries`

## Naming Decisions

- Member-scoped references use `project_members.id`.
- Todo state uses `pending`, `in_progress`, `blocked`, and `completed`.
- Issue risk uses `severity` with `low`, `medium`, `high`, and `critical`.
- Calendar timestamps use `starts_at` and `ends_at`.
- FAISS vectors remain outside PostgreSQL. PostgreSQL stores index metadata
  and external vector identifiers.

## Dev Merge Decision

The root-level `app/`, Alembic files, and `db/schema.postgresql.sql` from
`dev` are reference material for a separate prototype. They are not merged
into the deployable runtime because the repository architecture defines
`opsradar2/` as the application boundary.

Useful indexes from the latest ERD were added to `opsradar2/schema.sql` with
`IF NOT EXISTS`, excluding the root prototype's `documents(status)` index
because OpsRadar 2 intentionally uses `documents.analysis_status`.
