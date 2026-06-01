# Step 1: db-schema

## Files To Read

First read these files and understand the architecture and design intent:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `README.md`

Read code and docs from previous steps carefully before editing.

## Work

Create or update the DB design artifacts for PostgreSQL.

Required outputs:

- `docs/db-design-v2.md`
- `docs/table-definition.md`
- `db/schema.postgresql.sql`

The schema must include these tables:

- `users`
- `teams`
- `projects`
- `project_members`
- `documents`
- `document_chunks`
- `chunk_embeddings`
- `todos`
- `issues`
- `chat_messages`
- `weekly_reports`
- `handoff_reports`
- `ai_summaries`

Critical constraints:

- Use UUID primary keys with `gen_random_uuid()`.
- Add `project_id` to all project-scoped business tables.
- Use foreign keys for ownership and source references.
- Use check constraints for finite status/role/priority/severity values.
- Use `jsonb` only for flexible AI/source metadata.
- Add practical indexes for project dashboard queries.

## Acceptance Criteria

```bash
python -m json.tool phases/index.json
python -m json.tool phases/db-design-v2/index.json
```

## Verification

1. Confirm `db/schema.postgresql.sql` defines all required tables.
2. Confirm `docs/db-design-v2.md` includes an ERD or relationship summary.
3. Confirm `docs/table-definition.md` describes column type, key/nullability, default, and purpose.
4. Update `phases/db-design-v2/index.json` for this step:
   - Success: set `"status": "completed"` and add `"summary": "Created PostgreSQL schema, ERD, and table definition docs."`
   - Failure after 3 fix attempts: set `"status": "error"` and add `"error_message": "specific error"`
   - User input needed: set `"status": "blocked"` and add `"blocked_reason": "specific reason"`, then stop.

## Do Not

- Do not make `users` the owner of project business data. Reason: TeamMemory is project-scoped.
- Do not store raw embedding arrays in PostgreSQL. Reason: vector search is handled by an external vector store in v1.
- Do not remove project-level foreign keys to simplify inserts. Reason: the schema must protect project boundaries.
