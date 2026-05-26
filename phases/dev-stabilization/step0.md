# Step 0: api-contract-audit

## Files To Read

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/ADR.md`
- `opsradar2/frontend/index.html`
- `opsradar2/app/api/api.py`
- `opsradar2/app/api/v1/endpoints/*.py`
- `opsradar2/app/schemas/*.py`

## Work

Inventory the requests and response payloads used by the frontend against the
registered FastAPI routes. Add a concise API contract document under `docs/`
that labels each endpoint as implemented, placeholder, missing, or mismatched.
Fix only import, router-registration, or schema defects that prevent the
existing contract from loading; defer business implementation to Step 1.

## Acceptance Criteria

```bash
python -m compileall opsradar2/app
python scripts/execute.py --validate dev-stabilization
```

## Do Not

- Do not implement placeholder business logic in this step. Reason: contract
  mismatches must be understood before persistence behavior changes.
- Do not change frontend payload expectations without documenting the mismatch.
