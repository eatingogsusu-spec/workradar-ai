# TeamMemory Table Definition

## Core Ownership

- `teams`: workspace/team container.
- `projects`: service center. Most business data belongs to a project.
- `users`: login identity. Users are connected to projects and records as members, uploaders, assignees, reporters, or authors.
- `project_members`: N:M bridge between `projects` and `users`, with project-level role.

## Tables

| Table | Purpose | Important Constraints |
| --- | --- | --- |
| `users` | Login users | `email` unique, `password_hash` only, no raw password |
| `teams` | Team container | One team has many projects |
| `projects` | Project-centered business scope | `team_id`, `created_by`, status/date checks |
| `project_members` | User/project N:M membership | unique `(project_id, user_id)`, role in owner/manager/member/viewer |
| `documents` | Uploaded or connected source documents | required `project_id`, `uploaded_by`, source type supports upload, Slack, Notion, Meet, Gmail, Teams, Jira |
| `document_chunks` | RAG chunk units | required `document_id`, `project_id`; unique `(document_id, chunk_index)` |
| `chunk_embeddings` | FAISS vector references | stores `vector_store`, `vector_id`, `embedding_model`; no vector payload |
| `todos` | Project action items, including AI-extracted candidates | required `project_id`; `source_type` splits manual/AI; `approval_status` splits pending/approved/rejected |
| `issues` | Project risks/issues | required `project_id`; indexes on project, status, severity |
| `chat_messages` | Project AI/user chat log | required `project_id`; `sources_json` array for citations |
| `weekly_reports` | Generated weekly project report | required `project_id`; unique project/week range |
| `handoff_reports` | Generated handoff report | required `project_id`; `handoff_score` 0-100 |
| `ai_summaries` | AI-generated summaries and extracted entities | required `project_id`; `summary_type` constrained |

## Citation JSON Example

```json
[
  {
    "document_id": "00000000-0000-0000-0000-000000000402",
    "chunk_id": "00000000-0000-0000-0000-000000000504",
    "file_name": "meeting-notes-2026-05-12.docx",
    "page_number": 2
  }
]
```

## Extracted Summary JSON Example

```json
{
  "todos": ["Implement dashboard summary query"],
  "issues": ["Dashboard response schema needs sign-off"],
  "decisions": ["Use project_id as primary scope"]
}
```

## Todo Approval Model

AI-extracted Todo candidates are stored in the same `todos` table as official todos.

```text
source_type = manual, approval_status = approved  -> normal official Todo
source_type = ai,     approval_status = pending   -> AI Todo waiting for user approval
source_type = ai,     approval_status = approved  -> AI Todo approved by the user
source_type = ai,     approval_status = rejected  -> AI Todo rejected by the user
```

The frontend can show AI items with an icon or badge instead of needing a separate table.
