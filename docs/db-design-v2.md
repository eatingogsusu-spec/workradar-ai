# TeamMemory DB Design

TeamMemory is project-centered. Documents, todos, issues, chat messages, reports, summaries, and handoff artifacts belong to a project. Users are connected as uploaders, authors, assignees, reporters, and project members.

## ERD

```mermaid
erDiagram
  TEAMS ||--o{ PROJECTS : has
  USERS ||--o{ PROJECTS : creates
  PROJECTS ||--o{ PROJECT_MEMBERS : has
  USERS ||--o{ PROJECT_MEMBERS : joins

  PROJECTS ||--o{ DOCUMENTS : contains
  USERS ||--o{ DOCUMENTS : uploads
  DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits
  PROJECTS ||--o{ DOCUMENT_CHUNKS : scopes
  DOCUMENT_CHUNKS ||--o{ CHUNK_EMBEDDINGS : indexes

  PROJECTS ||--o{ TODOS : tracks
  USERS ||--o{ TODOS : assigned
  USERS ||--o{ TODOS : creates
  DOCUMENTS ||--o{ TODOS : sources
  DOCUMENT_CHUNKS ||--o{ TODOS : sources

  PROJECTS ||--o{ ISSUES : logs
  USERS ||--o{ ISSUES : reports
  USERS ||--o{ ISSUES : assigned
  DOCUMENTS ||--o{ ISSUES : sources

  PROJECTS ||--o{ CHAT_MESSAGES : contains
  USERS ||--o{ CHAT_MESSAGES : sends
  PROJECTS ||--o{ WEEKLY_REPORTS : has
  USERS ||--o{ WEEKLY_REPORTS : creates
  PROJECTS ||--o{ HANDOFF_REPORTS : has
  USERS ||--o{ HANDOFF_REPORTS : creates
  PROJECTS ||--o{ AI_SUMMARIES : has
  DOCUMENTS ||--o{ AI_SUMMARIES : summarized_by

  USERS {
    uuid id PK
    string name
    string email UK
    string password_hash
    string role
    timestamp created_at
    timestamp updated_at
  }

  TEAMS {
    uuid id PK
    string name
    timestamp created_at
    timestamp updated_at
  }

  PROJECTS {
    uuid id PK
    uuid team_id FK
    uuid created_by FK
    string name
    text description
    string status
    date start_date
    date end_date
    timestamp created_at
    timestamp updated_at
  }

  PROJECT_MEMBERS {
    uuid id PK
    uuid project_id FK
    uuid user_id FK
    string role
    timestamp joined_at
  }

  DOCUMENTS {
    uuid id PK
    uuid project_id FK
    uuid uploaded_by FK
    string file_name
    string file_type
    string source_type
    string storage_path
    string status
    timestamp uploaded_at
    timestamp created_at
    timestamp updated_at
  }

  DOCUMENT_CHUNKS {
    uuid id PK
    uuid document_id FK
    uuid project_id FK
    text content
    int chunk_index
    int page_number
    timestamp created_at
  }

  CHUNK_EMBEDDINGS {
    uuid id PK
    uuid chunk_id FK
    string vector_store "faiss"
    string vector_id "FAISS chunk id"
    string embedding_model
    timestamp created_at
  }

  TODOS {
    uuid id PK
    uuid project_id FK
    uuid assignee_id FK
    uuid created_by FK
    uuid source_document_id FK
    uuid source_chunk_id FK
    string title
    text description
    string status
    string priority
    string source_type
    string approval_status
    uuid reviewed_by FK
    timestamp reviewed_at
    date due_date
    timestamp created_at
    timestamp updated_at
  }

  ISSUES {
    uuid id PK
    uuid project_id FK
    uuid reporter_id FK
    uuid assignee_id FK
    uuid source_document_id FK
    string title
    text description
    string severity
    string status
    timestamp created_at
    timestamp updated_at
  }

  CHAT_MESSAGES {
    uuid id PK
    uuid project_id FK
    uuid user_id FK
    string role
    text content
    json sources_json
    timestamp created_at
  }

  WEEKLY_REPORTS {
    uuid id PK
    uuid project_id FK
    uuid created_by FK
    date week_start
    date week_end
    text content
    int progress_rate
    timestamp created_at
    timestamp updated_at
  }

  HANDOFF_REPORTS {
    uuid id PK
    uuid project_id FK
    uuid created_by FK
    string title
    text content
    int handoff_score
    json missing_items_json
    timestamp created_at
    timestamp updated_at
  }

  AI_SUMMARIES {
    uuid id PK
    uuid project_id FK
    uuid document_id FK
    string summary_type
    text summary
    json extracted_json
    timestamp created_at
  }
```

## Notes

- `project_members` is the N:M bridge between users and projects and stores the project role.
- `document_chunks` keeps `project_id` to make project-scoped RAG filtering cheap and explicit.
- `chunk_embeddings` stores only FAISS metadata. The embedding vector itself is not stored in PostgreSQL.
- AI-extracted todos and manually-created todos share the `todos` table. Use `source_type` (`ai` or `manual`) and `approval_status` (`pending`, `approved`, `rejected`) to split them in the Todo page.
- `chat_messages.sources_json` stores answer citations such as `document_id`, `chunk_id`, `file_name`, and `page_number`.
- `ai_summaries.extracted_json` stores flexible AI outputs such as summaries, extracted issue candidates, and optional decisions. Approved Todo items live in `todos`.
