-- TeamAZAG PostgreSQL schema v3.
-- Based on opsradar_final_front.html frontend functions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'member', 'viewer'))
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
  CONSTRAINT project_members_role_check CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
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
  source_type VARCHAR(50) NOT NULL DEFAULT 'upload',
  storage_path TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
  uploaded_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT documents_source_type_check CHECK (
    source_type IN ('upload', 'meeting', 'chat', 'issue_log', 'email', 'report', 'other')
  ),
  CONSTRAINT documents_status_check CHECK (
    status IN ('uploaded', 'parsing', 'chunking', 'embedding', 'analyzing', 'completed', 'failed')
  )
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status ON documents(status);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  token_count INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT document_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT document_chunks_page_check CHECK (page_number IS NULL OR page_number > 0),
  CONSTRAINT document_chunks_token_check CHECK (token_count IS NULL OR token_count >= 0),
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

CREATE TABLE analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT analysis_jobs_status_check CHECK (
    status IN ('queued', 'running', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT analysis_jobs_progress_check CHECK (progress_percent BETWEEN 0 AND 100)
);

CREATE INDEX idx_analysis_jobs_project_id ON analysis_jobs(project_id);
CREATE INDEX idx_analysis_jobs_document_id ON analysis_jobs(document_id);
CREATE INDEX idx_analysis_jobs_status ON analysis_jobs(status);

CREATE TABLE analysis_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
  step_name VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'waiting',
  step_order INTEGER NOT NULL,
  message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  CONSTRAINT analysis_steps_name_check CHECK (
    step_name IN ('parsing', 'chunking', 'embedding', 'ai_analysis', 'dashboard_sync')
  ),
  CONSTRAINT analysis_steps_status_check CHECK (
    status IN ('waiting', 'running', 'completed', 'failed', 'skipped')
  ),
  CONSTRAINT analysis_steps_order_check CHECK (step_order >= 0),
  CONSTRAINT uq_analysis_steps_job_step UNIQUE (analysis_job_id, step_name)
);

CREATE INDEX idx_analysis_steps_job_id ON analysis_steps(analysis_job_id);

CREATE TABLE ai_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID REFERENCES analysis_jobs(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  extraction_type VARCHAR(50) NOT NULL,
  title VARCHAR(500),
  body TEXT,
  confidence_score INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'candidate',
  extracted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ai_extractions_type_check CHECK (
    extraction_type IN ('todo', 'issue', 'summary', 'decision', 'handoff', 'risk')
  ),
  CONSTRAINT ai_extractions_status_check CHECK (
    status IN ('candidate', 'accepted', 'rejected', 'promoted')
  ),
  CONSTRAINT ai_extractions_confidence_check CHECK (
    confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100
  ),
  CONSTRAINT ai_extractions_json_check CHECK (jsonb_typeof(extracted_json) = 'object')
);

CREATE INDEX idx_ai_extractions_project_type ON ai_extractions(project_id, extraction_type);
CREATE INDEX idx_ai_extractions_source_chunk ON ai_extractions(source_chunk_id);

CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  source_extraction_id UUID REFERENCES ai_extractions(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  source_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  confidence_score INTEGER,
  is_candidate BOOLEAN NOT NULL DEFAULT false,
  detected_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT issues_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT issues_status_check CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved', 'ignored')),
  CONSTRAINT issues_source_type_check CHECK (source_type IN ('ai', 'manual')),
  CONSTRAINT issues_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_issues_project_status ON issues(project_id, status);
CREATE INDEX idx_issues_project_candidate ON issues(project_id, is_candidate);
CREATE INDEX idx_issues_project_severity ON issues(project_id, severity);

CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  source_extraction_id UUID REFERENCES ai_extractions(id) ON DELETE SET NULL,
  linked_issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
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
  CONSTRAINT todos_status_check CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed')),
  CONSTRAINT todos_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT todos_source_type_check CHECK (source_type IN ('manual', 'ai')),
  CONSTRAINT todos_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT todos_confidence_score_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_todos_project_id ON todos(project_id);
CREATE INDEX idx_todos_project_status ON todos(project_id, status);
CREATE INDEX idx_todos_project_approval ON todos(project_id, approval_status);
CREATE INDEX idx_todos_assignee_id ON todos(assignee_id);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_linked_issue_id ON todos(linked_issue_id);

CREATE TABLE issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  note TEXT,
  changed_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT issue_status_history_to_check CHECK (
    to_status IN ('open', 'in_progress', 'blocked', 'resolved', 'ignored')
  )
);

CREATE INDEX idx_issue_status_history_issue_id ON issue_status_history(issue_id);
CREATE INDEX idx_issue_status_history_changed_at ON issue_status_history(changed_at);

CREATE TABLE project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'none',
  start_at TIMESTAMP NOT NULL,
  end_at TIMESTAMP,
  location VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT project_events_type_check CHECK (
    event_type IN ('meeting', 'deadline', 'absence', 'milestone', 'deployment', 'other')
  ),
  CONSTRAINT project_events_risk_check CHECK (risk_level IN ('none', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT project_events_date_check CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX idx_project_events_project_start ON project_events(project_id, start_at);
CREATE INDEX idx_project_events_type ON project_events(event_type);

CREATE TABLE risk_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  related_todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  related_issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  confidence_score INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT risk_windows_level_check CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT risk_windows_date_check CHECK (end_date >= start_date),
  CONSTRAINT risk_windows_confidence_check CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_risk_windows_project_dates ON risk_windows(project_id, start_date, end_date);
CREATE INDEX idx_risk_windows_level ON risk_windows(risk_level);

CREATE TABLE project_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  report_type VARCHAR(20) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  progress_rate INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT project_reports_type_check CHECK (report_type IN ('weekly', 'monthly')),
  CONSTRAINT project_reports_status_check CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
  CONSTRAINT project_reports_version_check CHECK (version > 0),
  CONSTRAINT project_reports_progress_check CHECK (progress_rate BETWEEN 0 AND 100),
  CONSTRAINT project_reports_period_check CHECK (period_end >= period_start),
  CONSTRAINT uq_project_reports_period_version UNIQUE (project_id, report_type, period_start, period_end, version)
);

CREATE INDEX idx_project_reports_project_period ON project_reports(project_id, report_type, period_start);

CREATE TABLE handoff_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  handoff_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT handoff_reports_score_check CHECK (handoff_score BETWEEN 0 AND 100)
);

CREATE INDEX idx_handoff_reports_project_created ON handoff_reports(project_id, created_at);

CREATE TABLE handoff_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_report_id UUID NOT NULL REFERENCES handoff_reports(id) ON DELETE CASCADE,
  related_todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,
  related_issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  related_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  item_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT handoff_items_type_check CHECK (
    item_type IN ('decision', 'next_action', 'open_issue', 'onboarding', 'absence', 'risk')
  ),
  CONSTRAINT handoff_items_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT handoff_items_status_check CHECK (status IN ('open', 'done', 'archived'))
);

CREATE INDEX idx_handoff_items_report_id ON handoff_items(handoff_report_id);
CREATE INDEX idx_handoff_items_type ON handoff_items(item_type);

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_sessions_project_id ON chat_sessions(project_id);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_role_check CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX idx_chat_messages_session_created ON chat_messages(chat_session_id, created_at);

CREATE TABLE chat_message_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
  source_label VARCHAR(500),
  page_number INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT chat_message_sources_page_check CHECK (page_number IS NULL OR page_number > 0)
);

CREATE INDEX idx_chat_message_sources_message_id ON chat_message_sources(chat_message_id);
CREATE INDEX idx_chat_message_sources_document_id ON chat_message_sources(document_id);

CREATE TABLE project_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT project_activity_logs_type_check CHECK (
    activity_type IN ('document_uploaded', 'analysis_completed', 'todo_changed', 'issue_changed', 'event_created', 'report_saved', 'handoff_created', 'chat_answered')
  ),
  CONSTRAINT project_activity_logs_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_project_activity_logs_project_created ON project_activity_logs(project_id, created_at);
CREATE INDEX idx_project_activity_logs_type ON project_activity_logs(activity_type);
