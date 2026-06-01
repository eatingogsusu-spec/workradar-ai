# ADR

## ADR-001: Use Project-Centered Data Model

Status: Accepted

TeamMemory is a project handoff service, not a personal memo app. All business data that appears in the product UI must be scoped by `project_id`.

Decision:
- Add `projects` as the central aggregate.
- Add `project_members` for membership and role management.
- Require `project_id` on documents, todos, issues, chat messages, reports, and AI summaries.

## ADR-002: Use PostgreSQL for the Initial DB Draft

Status: Accepted

PostgreSQL gives the team UUIDs, relational constraints, JSONB fields, and enough flexibility for the first DB handoff.

Decision:
- Use PostgreSQL DDL in `db/schema.postgresql.sql`.
- Use `gen_random_uuid()` from `pgcrypto`.
- Use `jsonb` for flexible AI extraction metadata.

## ADR-003: Store Vector References, Not Raw Vectors

Status: Accepted

The first DB version should avoid coupling the relational schema to a specific vector database implementation.

Decision:
- Store document text chunks in `document_chunks`.
- Store external vector store metadata in `chunk_embeddings`.
- Do not store raw embedding arrays in PostgreSQL for v1.
