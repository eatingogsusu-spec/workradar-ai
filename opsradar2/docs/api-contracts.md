# OpsRadar Frontend/Backend API Contracts

This document is the handoff point between the React frontend and the
FastAPI backend.

## Base URL

The frontend should use same-origin API calls by default:

```js
window.OPSRADAR_API_BASE || "/api/v1"
```

For local React/Vite development, use one of these:

- Primary local entrypoint: `http://127.0.0.1:8002`
- FastAPI serves the frontend and API together, so same-origin `/api/v1` calls work by default.
- CRA dev server can proxy `/api` to `http://127.0.0.1:8002`.

## Runtime Metadata

| Frontend action | Method | Backend path |
| --- | --- | --- |
| API health check | GET | `/api/v1/system/health` |
| Frontend runtime config | GET | `/api/v1/system/frontend-config` |

## Core Paths Used By Frontend

| Frontend action | Method | Backend path |
| --- | --- | --- |
| Dashboard summary | GET | `/api/v1/dashboard/summary` |
| Load todos | GET | `/api/v1/todos` |
| Create todo | POST | `/api/v1/todos` |
| Update todo | PATCH | `/api/v1/todos/{todo_id}` |
| Load issues | GET | `/api/v1/issues` |
| Create issue | POST | `/api/v1/issues` |
| Update issue | PATCH | `/api/v1/issues/{issue_id}` |
| Resolve issue | PATCH | `/api/v1/issues/{issue_id}/resolve` |
| Create todo from issue | POST | `/api/v1/issues/{issue_id}/todos` |
| Load calendar | GET | `/api/v1/calendar` |
| Create calendar event | POST | `/api/v1/calendar/` |
| Delete calendar event | DELETE | `/api/v1/calendar/{event_id}` |
| Load reports | GET | `/api/v1/reports` |
| Generate report | POST | `/api/v1/reports/generate` |
| Update report | PATCH | `/api/v1/reports/{report_id}` |
| Chat | POST | `/api/v1/chat` |
| Extract todos/issues from text | POST | `/api/v1/chat/extract` |
| Upload document for AI analysis | POST | `/api/v1/documents/upload` |
| List documents | GET | `/api/v1/documents` |
| Document analysis status | GET | `/api/v1/documents/{document_id}/status` |
| Load document chunks | GET | `/api/v1/documents/{document_id}/chunks` |
| Create todo from document chunk | POST | `/api/v1/documents/{document_id}/chunks/{chunk_id}/todos` |
| Create issue from document chunk | POST | `/api/v1/documents/{document_id}/chunks/{chunk_id}/issues` |

## Document Upload Flow

The product should support two paths at the same time:

- AI-generated candidates from uploaded documents
- Manual Todo/Issue creation from selected document chunks

When `AI_PROVIDER=disabled`, document upload should still persist:

- `documents`
- `document_chunks`

It should not automatically create AI-derived todos, issues, or summaries.
The frontend should show document chunks and let the user manually create
Todo/Issue records from a selected chunk.

When AI is enabled, the backend may additionally create candidate records:

- `todos` with `source_type = "ai"` and `approval_status = "pending"`
- `issues` with `source_type = "ai"` and `approval_status = "pending"`
- `ai_summaries`

Manual creation APIs remain available even when AI is enabled. Manual records
should use `source_type = "manual"` and store `source_document_id` /
`source_chunk_id` so the frontend can show where the Todo/Issue came from.

## Response Shape Rule

Backend responses should keep stable top-level keys:

- `GET /todos` -> `{ "todos": [...] }`
- `GET /issues` -> `{ "issues": [...] }`
- `GET /calendar` -> `{ "events": [...] }`
- `GET /reports` -> `{ "reports": [...] }`
- `POST /reports/generate` -> includes `report_id`
- `POST /calendar/` -> includes `event`
- `POST /documents/upload` -> includes `document_id` and `analysis_status`
- `GET /documents/{document_id}/status` -> includes `analysis_status` and `progress`
- `GET /documents/{document_id}/chunks` -> includes `document` and `chunks`
- `POST /documents/{document_id}/chunks/{chunk_id}/todos` -> includes `todo_id` and `source_chunk_id`
- `POST /documents/{document_id}/chunks/{chunk_id}/issues` -> includes `issue` and `source_chunk_id`
- `POST /chat` -> includes `answer`, `sources`, and `suggested_questions`
- `GET /system/frontend-config` -> includes `apiBase` and `features`

When changing any of these, update the React API client and
`tests/test_runtime_configuration.py` in the same PR.
