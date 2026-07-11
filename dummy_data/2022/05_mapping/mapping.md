# 2022 Source Seed Mapping

This dataset is a business-source seed, not a DB-ready seed. Loaders must inspect the current PostgreSQL schema before insertion.

## Transformation rules
- Convert source string IDs with deterministic UUID5 using `source_type + ':' + source_id`.
- Map `file_path` to `documents.storage_uri`, `doc_type` to `documents.file_type`, and `created_date` to `documents.created_at`.
- Put raw body text into `document_chunks.content`; use the file name as `documents.file_name`.
- Map `related_issue_id` to `todos.linked_issue_id` where the current schema supports it.
- Resolve employee names to current user/member UUIDs before setting assignees or handoff owners.
- Normalize all status values against current CHECK constraints.
- Fill required columns only with documented defaults; never invent relationship IDs.

## FK and load rules
Load teams, users, projects, project_members, documents, document_chunks, issues, todos, and calendar/report/handoff tables in parent-first order. Validate orphans and row counts after every stage. Tables absent from the current schema must be skipped.
