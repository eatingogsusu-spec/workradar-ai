# Project: TeamAZAG OpsRadar

## Application Boundary

- The deployable application lives under `opsradar2/`.
- The backend is a FastAPI service mounted under `/api/v1`.
- The current frontend is served from `opsradar2/frontend/index.html`.
- PostgreSQL access uses SQLAlchemy asynchronous sessions.

## Architecture Rules

- CRITICAL: Keep route handlers thin. Business decisions belong in
  `opsradar2/app/services/` and persistence belongs in
  `opsradar2/app/repositories/`.
- CRITICAL: Keep API request and response validation in
  `opsradar2/app/schemas/`; do not silently change the frontend-facing payload
  contract.
- CRITICAL: Use `get_db()` and async SQLAlchemy patterns for database work; do
  not open ad hoc database connections in endpoints.
- CRITICAL: Do not commit secrets or a populated `.env` file.
- Keep AI provider and vector-store integrations behind the existing
  `app/ai/`, `app/services/`, and `app/vectorstores/` boundaries.

## Development Process

- Read `docs/ARCHITECTURE.md`, `docs/ADR.md`, and the applicable Harness step
  before changing application behavior.
- Use phase files under `phases/` for scoped work executed through
  `scripts/execute.py`.
- Add or update tests when implementing an endpoint contract or persistence
  behavior.
- Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`,
  or `chore:`.

## Verification

```bash
python -m compileall opsradar2/app
python scripts/execute.py --validate dev-stabilization
```
