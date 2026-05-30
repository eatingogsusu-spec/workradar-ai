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
| `chunk_embeddings` | FAISS vector references | stores `faiss_index_path`, integer `faiss_index_id`, `embedding_model`; no vector payload |
| `todos` | Project action items, including AI-extracted candidates | required `project_id`; optional `linked_issue_id`; `source_type` splits manual/AI; `approval_status` splits pending/approved/rejected; optional `confidence_score` |
| `issues` | Project risks/issues | required `project_id`; `source_type` splits manual/AI; `is_candidate` splits candidate/confirmed tabs; optional `confidence_score` |
| `chat_messages` | Project AI/user chat log | required `project_id`; `sources_json` array for citations |
| `weekly_reports` | Generated weekly project report | required `project_id`; unique project/week range |
| `monthly_reports` | Generated monthly project report | required `project_id`; unique project/month range |
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

## Issue Candidate Model

AI-extracted issue candidates are stored in the same `issues` table as confirmed issues.

```text
is_candidate = true   -> candidate issue shown in the candidate tab
is_candidate = false  -> confirmed issue shown in the official issue tab
```

`confidence_score` is nullable and constrained to 0-100 when present.

## Enum Values

```text
documents.source_type: email, meeting, chat, other
documents.status: parsing, embedding, completed, failed
todos.status: pending, in_progress, completed
todos.priority / issues.severity: high, medium, low
todos.source_type / issues.source_type: ai, manual
todos.approval_status: pending, approved, rejected
issues.status: open, in_progress, resolved
chat_messages.role: user, assistant
report period / ai_summaries.summary_type: weekly, monthly
project_members.role: admin, member
```

## Chat Source Model

For MVP, `chat_messages.sources_json JSONB` remains the source citation store. A separate `chat_message_sources` table can be added later if reverse lookups like "show chats that referenced this document" become a priority.
