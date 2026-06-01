# Latest ERD Schema Sync

This branch treats `opsradar_erd_postgresql_faiss.html` as the DB design reference, and the executable PostgreSQL source of truth is `schema.postgresql.sql`.

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

## Important Naming Decisions

- Member-scoped references use `project_members.id`.
- Todo state uses `status` with `pending`, `in_progress`, `blocked`, and `completed`.
- Issue risk uses `severity` with `low`, `medium`, `high`, and `critical`.
- Calendar timestamps use `starts_at` and `ends_at`.
- FAISS vectors are not stored in PostgreSQL. PostgreSQL stores `faiss_indexes` and `chunk_embeddings.vector_external_id`.

## API Scope

The FastAPI app keeps the current read-oriented surface stable:

- project list
- dashboard summary
- Todo list and AI pending Todo list
- Issue list
- document list
- latest handoff
- chat message create/list

Full CRUD expansion is intentionally left for a later API integration pass.