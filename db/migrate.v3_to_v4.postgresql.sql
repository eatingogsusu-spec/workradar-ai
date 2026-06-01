-- OpsRadar v3 -> v4 additive migration.
-- Non-destructive: keeps existing tables/columns and adds the FAISS/index/job and approval fields
-- needed by the revised ERD. Review before running on production.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS faiss_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  index_path TEXT NOT NULL,
  embedding_model VARCHAR(120) NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  CONSTRAINT faiss_indexes_dimension_check CHECK (embedding_dimension > 0),
  CONSTRAINT faiss_indexes_version_check CHECK (version > 0),
  CONSTRAINT faiss_indexes_status_check CHECK (status IN ('building', 'active', 'superseded', 'failed')),
  CONSTRAINT uq_faiss_indexes_project_version UNIQUE (project_id, embedding_model, version),
  CONSTRAINT uq_faiss_indexes_path UNIQUE (index_path)
);

CREATE INDEX IF NOT EXISTS idx_faiss_indexes_project_status
  ON faiss_indexes(project_id, status);

CREATE TABLE IF NOT EXISTS embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  faiss_index_id UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'document_embedding',
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CONSTRAINT embedding_jobs_type_check CHECK (job_type IN ('document_embedding', 'index_rebuild', 'index_compaction')),
  CONSTRAINT embedding_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT embedding_jobs_time_check CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_project_status
  ON embedding_jobs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_document_id
  ON embedding_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_faiss_index_id
  ON embedding_jobs(faiss_index_id);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'active';

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS uploaded_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_uri TEXT,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(128);

ALTER TABLE chunk_embeddings
  ADD COLUMN IF NOT EXISTS faiss_index_uuid UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vector_external_id INTEGER,
  ADD COLUMN IF NOT EXISTS embedding_dimension INTEGER;

ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS assignee_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS assignee_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'approved';

ALTER TABLE ai_summaries
  ADD COLUMN IF NOT EXISTS source_faiss_index_id UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS todo_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issue_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documents_uploader_member
  ON documents(uploaded_by_member_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_hash
  ON document_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_faiss_index_uuid
  ON chunk_embeddings(faiss_index_uuid);
CREATE INDEX IF NOT EXISTS idx_todos_assignee_member_id
  ON todos(assignee_member_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_at
  ON todos(due_at);
CREATE INDEX IF NOT EXISTS idx_issues_assignee_member_id
  ON issues(assignee_member_id);
CREATE INDEX IF NOT EXISTS idx_issues_source_chunk_id
  ON issues(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_faiss_index_id
  ON ai_summaries(source_faiss_index_id);
