-- OpsRadar PostgreSQL + FAISS schema v4.
-- Fresh install schema generated from opsradar_erd_postgresql_faiss.html.
-- This file creates the tables for an empty database/schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_teams_name UNIQUE (name)
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
  CONSTRAINT uq_users_id_team UNIQUE (id, team_id),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'member', 'viewer'))
);

CREATE INDEX idx_users_team_id ON users(team_id);
CREATE INDEX idx_users_active_email ON users(email) WHERE deleted_at IS NULL;

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_projects_id_team UNIQUE (id, team_id),
  CONSTRAINT uq_projects_team_name UNIQUE (team_id, name),
  CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived', 'completed'))
);

CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_active ON projects(team_id, status) WHERE deleted_at IS NULL;

CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_project_members_project_team FOREIGN KEY (project_id, team_id)
    REFERENCES projects(id, team_id) ON DELETE CASCADE,
  CONSTRAINT fk_project_members_user_team FOREIGN KEY (user_id, team_id)
    REFERENCES users(id, team_id) ON DELETE CASCADE,
  CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id),
  CONSTRAINT uq_project_members_project_id UNIQUE (project_id, id),
  CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
  CONSTRAINT project_members_status_check CHECK (status IN ('active', 'invited', 'disabled'))
);

CREATE INDEX idx_project_members_team_id ON project_members(team_id);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by_member_id UUID,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(80) NOT NULL,
  storage_uri TEXT NOT NULL,
  content_hash VARCHAR(128),
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fk_documents_uploader_member FOREIGN KEY (uploaded_by_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT documents_status_check CHECK (
    status IN ('uploaded', 'parsing', 'chunking', 'embedding', 'analyzing', 'completed', 'failed', 'deleted')
  ),
  CONSTRAINT uq_documents_project_content_hash UNIQUE (project_id, content_hash)
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_status ON documents(project_id, status);
CREATE INDEX idx_documents_uploader_member ON documents(uploaded_by_member_id);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  content_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_token_check CHECK (token_count IS NULL OR token_count >= 0),
  CONSTRAINT uq_document_chunks_document_index UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_content_hash ON document_chunks(content_hash);

CREATE TABLE faiss_indexes (
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

CREATE INDEX idx_faiss_indexes_project_status ON faiss_indexes(project_id, status);

CREATE TABLE chunk_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  faiss_index_id UUID NOT NULL REFERENCES faiss_indexes(id) ON DELETE CASCADE,
  vector_external_id INTEGER NOT NULL,
  embedding_model VARCHAR(120) NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chunk_embeddings_vector_check CHECK (vector_external_id >= 0),
  CONSTRAINT chunk_embeddings_dimension_check CHECK (embedding_dimension > 0),
  CONSTRAINT uq_chunk_embeddings_index_vector UNIQUE (faiss_index_id, vector_external_id),
  CONSTRAINT uq_chunk_embeddings_chunk_index UNIQUE (chunk_id, faiss_index_id)
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
  CONSTRAINT embedding_jobs_type_check CHECK (job_type IN ('document_embedding', 'index_rebuild', 'index_compaction')),
  CONSTRAINT embedding_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT embedding_jobs_time_check CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);

CREATE INDEX idx_embedding_jobs_project_status ON embedding_jobs(project_id, status);
CREATE INDEX idx_embedding_jobs_document_id ON embedding_jobs(document_id);
CREATE INDEX idx_embedding_jobs_faiss_index_id ON embedding_jobs(faiss_index_id);

CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_member_id UUID,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'approved',
  confidence_score INTEGER,
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_todos_assignee_member FOREIGN KEY (assignee_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT todos_status_check CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')),
  CONSTRAINT todos_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT todos_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT todos_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected', 'edited')),
  CONSTRAINT todos_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_todos_project_status ON todos(project_id, status);
CREATE INDEX idx_todos_project_approval ON todos(project_id, approval_status);
CREATE INDEX idx_todos_assignee_member_id ON todos(assignee_member_id);
CREATE INDEX idx_todos_due_at ON todos(due_at);
CREATE INDEX idx_todos_source_chunk_id ON todos(source_chunk_id);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_member_id UUID,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'approved',
  confidence_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_issues_assignee_member FOREIGN KEY (assignee_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT issues_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT issues_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'ignored')),
  CONSTRAINT issues_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT issues_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected', 'edited')),
  CONSTRAINT issues_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_project_approval ON issues(project_id, approval_status);
CREATE INDEX idx_issues_project_severity ON issues(project_id, severity);
CREATE INDEX idx_issues_assignee_member_id ON issues(assignee_member_id);
CREATE INDEX idx_issues_source_chunk_id ON issues(source_chunk_id);

CREATE TABLE issue_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  changed_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT issue_history_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'ignored'))
);

CREATE INDEX idx_issue_history_issue_created ON issue_history(issue_id, created_at);
CREATE INDEX idx_issue_history_changed_by_member ON issue_history(changed_by_member_id);

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'approved',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_calendar_events_member FOREIGN KEY (member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT calendar_events_type_check CHECK (event_type IN ('meeting', 'deadline', 'absence', 'milestone', 'deployment', 'other')),
  CONSTRAINT calendar_events_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT calendar_events_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected', 'edited')),
  CONSTRAINT calendar_events_time_check CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX idx_calendar_events_project_starts ON calendar_events(project_id, starts_at);
CREATE INDEX idx_calendar_events_member_id ON calendar_events(member_id);
CREATE INDEX idx_calendar_events_source_chunk_id ON calendar_events(source_chunk_id);

CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_member_id UUID,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_weekly_reports_creator_member FOREIGN KEY (created_by_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT weekly_reports_week_check CHECK (week_end >= week_start),
  CONSTRAINT weekly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT uq_weekly_reports_project_week UNIQUE (project_id, week_start, week_end)
);

CREATE INDEX idx_weekly_reports_project_week ON weekly_reports(project_id, week_start);

CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by_member_id UUID,
  month_start DATE NOT NULL,
  month_end DATE NOT NULL,
  content TEXT NOT NULL,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_monthly_reports_creator_member FOREIGN KEY (created_by_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT monthly_reports_month_check CHECK (month_end >= month_start),
  CONSTRAINT monthly_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT uq_monthly_reports_project_month UNIQUE (project_id, month_start, month_end)
);

CREATE INDEX idx_monthly_reports_project_month ON monthly_reports(project_id, month_start);

CREATE TABLE handoff_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_member_id UUID,
  to_member_id UUID,
  handoff_type VARCHAR(50) NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_handoff_reports_from_member FOREIGN KEY (from_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT fk_handoff_reports_to_member FOREIGN KEY (to_member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
  CONSTRAINT handoff_reports_type_check CHECK (handoff_type IN ('general', 'absence', 'handover', 'onboarding'))
);

CREATE INDEX idx_handoff_reports_project_created ON handoff_reports(project_id, created_at);
CREATE INDEX idx_handoff_reports_from_member ON handoff_reports(from_member_id);
CREATE INDEX idx_handoff_reports_to_member ON handoff_reports(to_member_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_chat_messages_member FOREIGN KEY (member_id)
    REFERENCES project_members(id) ON DELETE SET NULL,
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
  CONSTRAINT ai_summaries_count_check CHECK (todo_count >= 0 AND issue_count >= 0 AND blocked_count >= 0)
);

CREATE INDEX idx_ai_summaries_project_created ON ai_summaries(project_id, created_at);
CREATE INDEX idx_ai_summaries_document_id ON ai_summaries(document_id);
CREATE INDEX idx_ai_summaries_faiss_index_id ON ai_summaries(source_faiss_index_id);
