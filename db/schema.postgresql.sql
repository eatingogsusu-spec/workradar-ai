-- OpsRadar AI latest ERD schema.
-- Source of truth: opsradar_erd_postgresql_faiss.html.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS ai_summaries CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS handoff_reports CASCADE;
DROP TABLE IF EXISTS monthly_reports CASCADE;
DROP TABLE IF EXISTS weekly_reports CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS issue_history CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS embedding_jobs CASCADE;
DROP TABLE IF EXISTS chunk_embeddings CASCADE;
DROP TABLE IF EXISTS faiss_indexes CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_users_email UNIQUE (email),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'pm', 'member', 'backend', 'frontend', 'ai', 'infra', 'viewer'))
);

CREATE INDEX idx_users_team_id ON users(team_id);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description VARCHAR(1000),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT projects_status_check CHECK (status IN ('planning', 'active', 'in_progress', 'completed', 'archived'))
);

CREATE INDEX idx_projects_team_id ON projects(team_id);

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id),
  CONSTRAINT project_members_role_check CHECK (role IN ('admin', 'pm', 'member', 'backend', 'frontend', 'ai', 'infra', 'viewer')),
  CONSTRAINT project_members_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX idx_project_members_team_id ON project_members(team_id);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  storage_uri VARCHAR(1000) NOT NULL,
  content_hash VARCHAR(128),
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT documents_status_check CHECK (status IN ('uploaded', 'parsing', 'chunking', 'embedding', 'completed', 'failed'))
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_uploaded_by_member_id ON documents(uploaded_by_member_id);
CREATE INDEX idx_documents_status ON documents(status);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  content_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_token_count_check CHECK (token_count IS NULL OR token_count >= 0),
  CONSTRAINT uq_document_chunks_document_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);

CREATE TABLE faiss_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  index_path VARCHAR(1000) NOT NULL,
  embedding_model VARCHAR(100) NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(50) NOT NULL DEFAULT 'building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  CONSTRAINT faiss_indexes_dimension_check CHECK (embedding_dimension > 0),
  CONSTRAINT faiss_indexes_version_check CHECK (version > 0),
  CONSTRAINT faiss_indexes_status_check CHECK (status IN ('building', 'active', 'archived', 'failed')),
  CONSTRAINT uq_faiss_indexes_project_version UNIQUE (project_id, version)
);

CREATE INDEX idx_faiss_indexes_project_id ON faiss_indexes(project_id);

CREATE TABLE chunk_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  faiss_index_id UUID NOT NULL REFERENCES faiss_indexes(id) ON DELETE CASCADE,
  vector_external_id INTEGER NOT NULL,
  embedding_model VARCHAR(100) NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chunk_embeddings_vector_check CHECK (vector_external_id >= 0),
  CONSTRAINT chunk_embeddings_dimension_check CHECK (embedding_dimension > 0),
  CONSTRAINT uq_chunk_embeddings_faiss_vector UNIQUE (faiss_index_id, vector_external_id)
);

CREATE INDEX idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
CREATE INDEX idx_chunk_embeddings_faiss_index_id ON chunk_embeddings(faiss_index_id);

CREATE TABLE embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  faiss_index_id UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
  job_type VARCHAR(50) NOT NULL DEFAULT 'document_embedding',
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  CONSTRAINT embedding_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT embedding_jobs_time_check CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX idx_embedding_jobs_project_id ON embedding_jobs(project_id);
CREATE INDEX idx_embedding_jobs_document_id ON embedding_jobs(document_id);
CREATE INDEX idx_embedding_jobs_faiss_index_id ON embedding_jobs(faiss_index_id);
CREATE INDEX idx_embedding_jobs_status ON embedding_jobs(status);

CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'approved',
  confidence_score INTEGER,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT todos_status_check CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed')),
  CONSTRAINT todos_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT todos_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT todos_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT todos_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_todos_project_status ON todos(project_id, status);
CREATE INDEX idx_todos_project_approval ON todos(project_id, approval_status);
CREATE INDEX idx_todos_assignee_member_id ON todos(assignee_member_id);
CREATE INDEX idx_todos_due_at ON todos(due_at);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  severity VARCHAR(50) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
  confidence_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT issues_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT issues_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'ignored')),
  CONSTRAINT issues_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT issues_approval_status_check CHECK (approval_status IN ('candidate', 'confirmed', 'rejected')),
  CONSTRAINT issues_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_project_severity ON issues(project_id, severity);
CREATE INDEX idx_issues_project_approval ON issues(project_id, approval_status);

CREATE TABLE issue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  changed_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT issue_history_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'ignored'))
);

CREATE INDEX idx_issue_history_issue_id ON issue_history(issue_id);
CREATE INDEX idx_issue_history_changed_by_member_id ON issue_history(changed_by_member_id);

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL DEFAULT 'other',
  title VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'approved',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_type_check CHECK (event_type IN ('meeting', 'deadline', 'absence', 'milestone', 'deployment', 'other')),
  CONSTRAINT calendar_events_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT calendar_events_approval_check CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT calendar_events_time_check CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX idx_calendar_events_project_starts ON calendar_events(project_id, starts_at);
CREATE INDEX idx_calendar_events_member_id ON calendar_events(member_id);

CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reports_week_check CHECK (week_end >= week_start),
  CONSTRAINT weekly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT uq_weekly_reports_project_week UNIQUE (project_id, week_start, week_end)
);

CREATE INDEX idx_weekly_reports_project_week ON weekly_reports(project_id, week_start);

CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  month_start DATE NOT NULL,
  month_end DATE NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT monthly_reports_month_check CHECK (month_end >= month_start),
  CONSTRAINT monthly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT uq_monthly_reports_project_month UNIQUE (project_id, month_start, month_end)
);

CREATE INDEX idx_monthly_reports_project_month ON monthly_reports(project_id, month_start);

CREATE TABLE handoff_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  to_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  handoff_type VARCHAR(50) NOT NULL DEFAULT 'project',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT handoff_reports_type_check CHECK (handoff_type IN ('onboarding', 'absence', 'offboarding', 'project'))
);

CREATE INDEX idx_handoff_reports_project_created ON handoff_reports(project_id, created_at);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX idx_chat_messages_project_created ON chat_messages(project_id, created_at);
CREATE INDEX idx_chat_messages_member_id ON chat_messages(member_id);

CREATE TABLE ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_faiss_index_id UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
  todo_count INTEGER NOT NULL DEFAULT 0,
  issue_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_summaries_counts_check CHECK (todo_count >= 0 AND issue_count >= 0 AND blocked_count >= 0)
);

CREATE INDEX idx_ai_summaries_project_id ON ai_summaries(project_id);
CREATE INDEX idx_ai_summaries_document_id ON ai_summaries(document_id);
