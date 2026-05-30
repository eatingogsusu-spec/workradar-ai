# Project: TeamMemory

## Tech Stack
- PostgreSQL for core relational data
- SQL DDL and seed scripts for DB handoff
- Markdown documentation for PRD, architecture, ADR, ERD, and table definitions

## Architecture Rules
- CRITICAL: Treat `projects` as the service center. Do not attach documents, todos, issues, chat, reports, or AI summaries only to `users`.
- CRITICAL: Every project-scoped business table must include `project_id` unless it is a pure join/reference table.
- CRITICAL: Do not store raw password values. Store only `password_hash`.
- CRITICAL: Do not store embedding vectors directly in the first DB version. Store external vector store references in `chunk_embeddings`.
- Keep implementation artifacts under `db/` and design artifacts under `docs/`.

## Development Process
- CRITICAL: Read `docs/PRD.md`, `docs/ARCHITECTURE.md`, and `docs/ADR.md` before implementation work.
- Use Harness phase files under `phases/` for step-based Codex execution.
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- For DB work, update schema, seed data, query examples, and table documentation together.

## Commands
```bash
python scripts/execute.py db-design-v2
python -m json.tool phases/index.json
python -m json.tool phases/db-design-v2/index.json
```
