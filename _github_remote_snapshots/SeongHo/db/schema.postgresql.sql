-- TeamMemory project-centered PostgreSQL schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'member'))
);

CREATE INDEX ix_users_email ON users(email);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived', 'completed')),
  CONSTRAINT projects_date_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_projects_team_id ON projects(team_id);

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT project_members_role_check CHECK (role IN ('admin', 'member')),
  CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'other',
  storage_path TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'parsing',
  uploaded_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT documents_source_type_check CHECK (
    source_type IN ('email', 'meeting', 'chat', 'other')
  ),
  CONSTRAINT documents_status_check CHECK (status IN ('parsing', 'embedding', 'completed', 'failed'))
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_page_check CHECK (page_number IS NULL OR page_number > 0),
  CONSTRAINT uq_document_chunks_document_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_project_id ON document_chunks(project_id);

CREATE TABLE chunk_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  faiss_index_path VARCHAR(500) NOT NULL,
  faiss_index_id INTEGER NOT NULL,
  embedding_model VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT uq_chunk_embeddings_faiss_ref UNIQUE (faiss_index_path, faiss_index_id)
);

CREATE INDEX idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);

CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  linked_issue_id UUID,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'approved',
  confidence_score INTEGER,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  due_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT todos_status_check CHECK (status IN ('pending', 'in_progress', 'completed')),
  CONSTRAINT todos_priority_check CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT todos_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT todos_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT todos_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_todos_project_id ON todos(project_id);
CREATE INDEX idx_todos_assignee_id ON todos(assignee_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_source_type ON todos(source_type);
CREATE INDEX idx_todos_approval_status ON todos(approval_status);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_project_due_date ON todos(project_id, due_date);
CREATE INDEX idx_todos_project_approval ON todos(project_id, approval_status);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  confidence_score INTEGER,
  is_candidate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT issues_severity_check CHECK (severity IN ('low', 'medium', 'high')),
  CONSTRAINT issues_status_check CHECK (status IN ('open', 'in_progress', 'resolved')),
  CONSTRAINT issues_source_type_check CHECK (source_type IN ('ai', 'manual')),
  CONSTRAINT issues_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_severity ON issues(severity);
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_project_severity ON issues(project_id, severity);
CREATE INDEX idx_issues_project_candidate ON issues(project_id, is_candidate);

ALTER TABLE todos
  ADD CONSTRAINT fk_todos_linked_issue_id FOREIGN KEY (linked_issue_id) REFERENCES issues(id) ON DELETE SET NULL;

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  sources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant')),
  CONSTRAINT chat_messages_sources_array_check CHECK (jsonb_typeof(sources_json) = 'array')
);

CREATE INDEX idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX idx_chat_messages_project_created_at ON chat_messages(project_id, created_at);

CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reports_week_check CHECK (week_end >= week_start),
  CONSTRAINT weekly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT uq_weekly_reports_project_week UNIQUE (project_id, week_start, week_end)
);

CREATE INDEX idx_weekly_reports_project_week ON weekly_reports(project_id, week_start);

CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  month_start TIMESTAMP NOT NULL,
  month_end TIMESTAMP NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT monthly_reports_month_check CHECK (month_end >= month_start),
  CONSTRAINT monthly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT uq_monthly_reports_project_month UNIQUE (project_id, month_start, month_end)
);

CREATE INDEX idx_monthly_reports_project_month ON monthly_reports(project_id, month_start);

CREATE TABLE handoff_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  handoff_score INTEGER NOT NULL DEFAULT 0,
  missing_items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT handoff_reports_score_check CHECK (handoff_score BETWEEN 0 AND 100),
  CONSTRAINT handoff_reports_missing_array_check CHECK (jsonb_typeof(missing_items_json) = 'array')
);

CREATE INDEX idx_handoff_reports_project_created_at ON handoff_reports(project_id, created_at);

CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  summary_type VARCHAR(50) NOT NULL,
  summary TEXT NOT NULL,
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ai_summaries_type_check CHECK (
    summary_type IN ('weekly', 'monthly')
  ),
  CONSTRAINT ai_summaries_extracted_object_check CHECK (jsonb_typeof(extracted_json) = 'object')
);

CREATE INDEX idx_ai_summaries_project_type ON ai_summaries(project_id, summary_type);
