# OpsRadar 2 API Contract Audit

The deployable FastAPI application is `opsradar2/` and is mounted at
`/api/v1`. The static frontend entry point is `opsradar2/frontend/index.html`.

## Implemented And Persisted

| Method | Path | Frontend usage | Response shape |
| --- | --- | --- | --- |
| `GET` | `/dashboard/summary` | Dashboard counters | Summary object |
| `GET` | `/todos` | Todo list reload | `{ "todos": [...] }` |
| `POST` | `/todos` | Manual Todo create | `{ "status", "todo_id" }` |
| `PATCH` | `/todos/{todo_id}` | Todo approve, reject, complete, undo, edit | `{ "status", "todo_id" }` |
| `GET` | `/issues` | Issue list reload | `{ "issues": [...] }` |
| `POST` | `/issues` | Manual issue create | Created issue object |
| `PATCH` | `/issues/{issue_id}` | Issue confirm or ignore | `{ "status", "issue_id" }` |
| `PATCH` | `/issues/{issue_id}/resolve` | Issue resolve | `{ "status", "issue_id" }` |
| `POST` | `/issues/{issue_id}/todos` | Issue follow-up Todo create | `{ "status", "todo_id", "linked_issue_id" }` |
| `GET` | `/calendar` | Calendar reload | `{ "events": [...] }` |
| `POST` | `/calendar/` | Manual or chat calendar create | `{ "event": {...} }` |
| `DELETE` | `/calendar/{event_id}` | Calendar delete | `{ "message": "deleted" }` |
| `GET` | `/reports` | Report list reload | `{ "reports": [...] }` |
| `POST` | `/reports/generate` | Weekly or monthly report save | Generated report object |
| `PATCH` | `/reports/{report_id}` | Report body save | `{ "status", "report_id" }` |
| `POST` | `/chat` | AI assistant request | `{ "answer", "sources", "suggested_questions" }` |

## Explicit Placeholders

| Method | Path | Current behavior |
| --- | --- | --- |
| `POST` | `/documents/upload` | Returns `not_implemented`; document parsing and AI analysis are pending. |
| `GET` | `/documents/{document_id}/status` | Returns a placeholder completed status. |
| `GET` | `/documents` | Returns an empty list. |
| `GET` | `/knowledge/onboarding` | Returns an empty onboarding structure. |
| `GET` | `/knowledge/handover` | Returns an empty handover structure. |

## Notes

- The frontend API adapter is loaded from `/static/api-integration.js`.
- Todo, issue, calendar, and report writes use async repositories through
  service classes.
- Chat requires configured Azure OpenAI settings; it is not a local mock.
- The placeholder modules above remain follow-up work and are not claimed as
  complete.
