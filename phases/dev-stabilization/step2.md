# Step 2: verification-and-handoff

## Files To Read

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- Outputs and summaries from Steps 0 and 1
- `opsradar2/README.md`
- `opsradar2/tests/`

## Work

Complete regression tests for the stabilized API contract, update setup and
verification instructions in `opsradar2/README.md`, and document any remaining
placeholder modules as explicit follow-up work.

## Acceptance Criteria

```bash
python -m compileall opsradar2/app
python -m pytest opsradar2/tests
```

## Do Not

- Do not claim unimplemented AI or retrieval behavior is complete. Reason:
  handoff documentation must reflect executable behavior.
- Do not broaden the API contract beyond the audited stabilization scope.
