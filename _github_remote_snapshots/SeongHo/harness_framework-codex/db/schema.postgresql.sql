-- TeamMemory project-centered schema for PostgreSQL.
-- Run once before seed data:
--   psql -d teammemory -f db/schema.postgresql.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'member'))
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived', 'completed')),
  CONSTRAINT projects_date_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
  CONSTRAINT project_members_project_user_unique UNIQUE (project_id, user_id)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(30) NOT NULL,
  source_type VARCHAR(30) NOT NULL DEFAULT 'upload',
  storage_path TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documents_source_type_check CHECK (source_type IN ('upload', 'notion', 'email', 'slack', 'meeting')),
  CONSTRAINT documents_status_check CHECK (status IN ('uploaded', 'processing', 'completed', 'failed'))
);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_page_check CHECK (page_number IS NULL OR page_number > 0),
  CONSTRAINT document_chunks_document_index_unique UNIQUE (document_id, chunk_index)
);

CREATE TABLE chunk_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  vector_store VARCHAR(80) NOT NULL,
  vector_id VARCHAR(255) NOT NULL,
  embedding_model VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chunk_embeddings_vector_unique UNIQUE (vector_store, vector_id)
);

CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'todo',
  priority VARCHAR(30) NOT NULL DEFAULT 'medium',
  due_date DATE,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT todos_status_check CHECK (status IN ('todo', 'in_progress', 'done', 'delayed', 'cancelled')),
  CONSTRAINT todos_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity VARCHAR(30) NOT NULL DEFAULT 'medium',
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT issues_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT issues_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'))
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system')),
  CONSTRAINT chat_messages_sources_array_check CHECK (jsonb_typeof(sources_json) = 'array')
);

CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reports_week_check CHECK (week_end >= week_start),
  CONSTRAINT weekly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT weekly_reports_project_week_unique UNIQUE (project_id, week_start, week_end)
);

CREATE TABLE handoff_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  handoff_score INTEGER NOT NULL DEFAULT 0,
  missing_items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT handoff_reports_score_check CHECK (handoff_score BETWEEN 0 AND 100),
  CONSTRAINT handoff_reports_missing_array_check CHECK (jsonb_typeof(missing_items_json) = 'array')
);

CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  summary_type VARCHAR(40) NOT NULL,
  summary TEXT NOT NULL,
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_summaries_type_check CHECK (
    summary_type IN (
      'document_summary',
      'meeting_summary',
      'project_summary',
      'handoff_summary',
      'weekly_summary'
    )
  ),
  CONSTRAINT ai_summaries_extracted_object_check CHECK (jsonb_typeof(extracted_json) = 'object')
);

CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_document_chunks_project_id ON document_chunks(project_id);
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
CREATE INDEX idx_todos_project_due_date ON todos(project_id, due_date);
CREATE INDEX idx_todos_project_status ON todos(project_id, status);
CREATE INDEX idx_todos_assignee_id ON todos(assignee_id);
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_project_severity ON issues(project_id, severity);
CREATE INDEX idx_issues_assignee_id ON issues(assignee_id);
CREATE INDEX idx_chat_messages_project_created_at ON chat_messages(project_id, created_at);
CREATE INDEX idx_weekly_reports_project_week ON weekly_reports(project_id, week_start DESC);
CREATE INDEX idx_handoff_reports_project_created_at ON handoff_reports(project_id, created_at DESC);
CREATE INDEX idx_ai_summaries_project_type ON ai_summaries(project_id, summary_type);
