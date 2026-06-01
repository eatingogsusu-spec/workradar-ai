# Step 2: seed-and-queries

## Files To Read

First read these files and understand the architecture and design intent:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `docs/db-design-v2.md`
- `docs/table-definition.md`
- `db/schema.postgresql.sql`

Read code and docs from previous steps carefully before editing.

## Work

Create or update seed data and screen-oriented query examples for the TeamMemory MVP.

Required outputs:

- `db/seed.postgresql.sql`
- `db/dashboard-queries.postgresql.sql`

Seed data requirements:

- 5 users.
- 1 team.
- 1 project.
- 5 project memberships with distinct roles.
- At least 3 documents.
- At least 3 document chunks.
- At least 3 external vector references.
- At least 8 todos covering `done`, `in_progress`, `delayed`, and `todo`.
- At least 3 issues covering open/in-progress states and severity ordering.
- At least 5 chat messages with assistant source metadata.
- At least 1 weekly report.
- At least 1 handoff report with score and missing items.
- At least 1 AI summary.

Query requirements:

- Dashboard summary cards.
- Current week Todo list.
- Open issue list.
- Project document list.
- Project members.
- Chat history with source metadata.
- Latest handoff report.
- Projects visible to a user.

## Acceptance Criteria

```bash
python -m json.tool phases/index.json
python -m json.tool phases/db-design-v2/index.json
```

## Verification

1. Confirm seed data uses stable UUIDs so frontend/backend teammates can reference records.
2. Confirm dashboard query parameters use `:project_id`, `:week_start`, `:week_end`, or `:user_id`.
3. Confirm query examples map directly to the planned screens.
4. Update `phases/db-design-v2/index.json` for this step:
   - Success: set `"status": "completed"` and add `"summary": "Added sample data and dashboard/screen query SQL."`
   - Failure after 3 fix attempts: set `"status": "error"` and add `"error_message": "specific error"`
   - User input needed: set `"status": "blocked"` and add `"blocked_reason": "specific reason"`, then stop.

## Do Not

- Do not seed fewer than 5 users. Reason: the project team size is part of the handoff scenario.
- Do not write screen queries without `project_id` filtering. Reason: screens must stay project-scoped.
- Do not invent a second project unless requested. Reason: MVP sample data should stay easy for frontend teammates to inspect.
