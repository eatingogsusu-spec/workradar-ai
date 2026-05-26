# Step 1: service-repository-wiring

## Files To Read

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- The API contract document created in Step 0
- `opsradar2/app/api/v1/endpoints/*.py`
- `opsradar2/app/services/*.py`
- `opsradar2/app/repositories/*.py`
- `opsradar2/app/models/*.py`

## Work

Implement the highest-priority placeholder backend paths identified by Step 0
using typed schemas, service functions, and async repositories. Keep endpoint
handlers limited to HTTP concerns and dependency injection. Add focused tests
for newly implemented responses and repository/service decisions.

## Acceptance Criteria

```bash
python -m compileall opsradar2/app
python -m pytest opsradar2/tests
```

## Do Not

- Do not place SQLAlchemy queries directly in endpoint handlers. Reason:
  repository boundaries are part of the adopted architecture.
- Do not commit credentials or depend on a developer's local `.env`.
