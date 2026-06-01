# Step 0: project-docs

## Files To Read

First read these files and understand the architecture and design intent:

- `AGENTS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `PROJECT_CONTEXT.md` if present in the parent workspace

## Work

Update the Harness baseline documentation so it represents TeamMemory, a project-centered handoff service.

Required outputs:

- `README.md`: DB starter overview, file list, and recommended execution order.
- `docs/PRD.md`: product goal, users, MVP features, out-of-scope items, success criteria.
- `docs/ARCHITECTURE.md`: project-centered data ownership, storage strategy, dashboard data, file layout.
- `docs/ADR.md`: accepted decisions for project-centered modeling, PostgreSQL, and external vector references.
- `AGENTS.md`: TeamMemory-specific guardrails and DB workflow commands.

Keep the docs concise and implementation-ready. The next step must be able to design DB schema from these files without reading prior chat history.

## Acceptance Criteria

```bash
python -m json.tool phases/index.json
python -m json.tool phases/db-design-v2/index.json
```

## Verification

1. Confirm that `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/ADR.md` no longer contain template placeholders.
2. Confirm that `AGENTS.md` states `projects` is the central data model.
3. Update `phases/db-design-v2/index.json` for this step:
   - Success: set `"status": "completed"` and add `"summary": "Updated TeamMemory project docs and DB guardrails."`
   - Failure after 3 fix attempts: set `"status": "error"` and add `"error_message": "specific error"`
   - User input needed: set `"status": "blocked"` and add `"blocked_reason": "specific reason"`, then stop.

## Do Not

- Do not leave placeholder text in project docs. Reason: later steps depend on docs as source of truth.
- Do not introduce app implementation details outside the DB handoff scope. Reason: this phase is for DB design artifacts.
- Do not break existing Harness files under `.agents/`, `.codex/`, or `scripts/`.
