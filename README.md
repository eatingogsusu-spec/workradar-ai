# TeamMemory DB Starter

TeamMemory stores project documents, todos, issues, AI chat, reports, and handoff information around a project.

Current DB direction:

- PostgreSQL is the relational database.
- FAISS is used for document chunk embedding vector search.
- PostgreSQL does not store embedding vector payloads. It stores only FAISS references such as `chunk_embeddings.vector_store` and `chunk_embeddings.vector_id`.
- AI-extracted todos and manually-created todos share the `todos` table.
- The Todo page separates AI todos and official todos with `source_type` and `approval_status`.

## Files

- `docs/db-design-v2.md`: ERD and design notes
- `docs/table-definition.md`: table roles and important constraints
- `db/schema.postgresql.sql`: PostgreSQL DDL
- `db/seed.postgresql.sql`: sample data for frontend/backend development
- `db/dashboard-queries.postgresql.sql`: screen-oriented query examples
- `db/verify.postgresql.sql`: schema and seed verification queries
- `app/models.py`: SQLAlchemy ORM draft
- `alembic/versions/20260513_0001_create_teammemory_schema.py`: Alembic migration draft

## Recommended Order

```bash
psql -d teammemory -f db/schema.postgresql.sql
psql -d teammemory -f db/seed.postgresql.sql
psql -d teammemory -f db/verify.postgresql.sql
```

## Todo Approval Model

```text
source_type = manual, approval_status = approved  -> official todo created by a person
source_type = ai,     approval_status = pending   -> AI-extracted todo waiting for approval
source_type = ai,     approval_status = approved  -> AI-extracted todo approved by the user
source_type = ai,     approval_status = rejected  -> AI-extracted todo rejected by the user
```

## Backend Contract Draft

```text
GET /projects/{project_id}/dashboard
GET /projects/{project_id}/todos
GET /projects/{project_id}/todos/ai-pending
POST /projects/{project_id}/todos
PATCH /todos/{todo_id}
PATCH /todos/{todo_id}/approval
GET /projects/{project_id}/issues
POST /projects/{project_id}/issues
PATCH /issues/{issue_id}
GET /projects/{project_id}/documents
POST /projects/{project_id}/documents
POST /projects/{project_id}/chat
GET /projects/{project_id}/chat/messages
GET /projects/{project_id}/handoff/latest
```
