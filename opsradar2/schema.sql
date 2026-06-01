CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member', 'viewer')),
    status VARCHAR(50) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    uploaded_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'other'
        CHECK (file_type IN ('email', 'meeting', 'chat', 'issue_log', 'other')),
    mime_type VARCHAR(100),
    storage_uri VARCHAR(500),
    content_hash VARCHAR(128),
    analysis_status VARCHAR(50) NOT NULL DEFAULT 'uploaded'
        CHECK (analysis_status IN ('uploaded', 'parsing', 'chunking', 'embedding', 'analyzing', 'completed', 'failed')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    content_hash VARCHAR(128),
    page_number INTEGER,
    section_title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_document_chunks_document_index UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS faiss_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    index_path VARCHAR(500) NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    embedding_dimension INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'building'
        CHECK (status IN ('building', 'active', 'failed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activated_at TIMESTAMPTZ,
    CONSTRAINT uq_faiss_indexes_project_version UNIQUE (project_id, version)
);

CREATE TABLE IF NOT EXISTS chunk_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    faiss_index_id UUID NOT NULL REFERENCES faiss_indexes(id) ON DELETE CASCADE,
    vector_external_id INTEGER NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    embedding_dimension INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_chunk_embeddings_index_vector UNIQUE (faiss_index_id, vector_external_id),
    CONSTRAINT uq_chunk_embeddings_chunk_index UNIQUE (chunk_id, faiss_index_id)
);

CREATE TABLE IF NOT EXISTS embedding_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    faiss_index_id UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
    job_type VARCHAR(50) NOT NULL DEFAULT 'document'
        CHECK (job_type IN ('document', 'rebuild')),
    status VARCHAR(50) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    reporter_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'blocked', 'resolved')),
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('ai', 'manual')),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    is_candidate BOOLEAN NOT NULL DEFAULT false,
    risk_reason TEXT,
    domino_chain TEXT,
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    created_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    reviewed_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    source_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    linked_issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('ai', 'manual')),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
    due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,
    changed_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL
        CHECK (event_type IN ('absence', 'deadline', 'milestone', 'meeting')),
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('ai', 'manual', 'chat')),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    content TEXT,
    progress_rate INTEGER CHECK (progress_rate BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_weekly_reports_project_week UNIQUE (project_id, week_start)
);

CREATE TABLE IF NOT EXISTS monthly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_by_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    month_start DATE NOT NULL,
    month_end DATE NOT NULL,
    content TEXT,
    progress_rate INTEGER CHECK (progress_rate BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_monthly_reports_project_month UNIQUE (project_id, month_start)
);

CREATE TABLE IF NOT EXISTS handoff_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    to_member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    handoff_type VARCHAR(50) NOT NULL DEFAULT 'general',
    content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    member_id UUID REFERENCES project_members(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    sources_json JSONB,
    model_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_faiss_index_id UUID REFERENCES faiss_indexes(id) ON DELETE SET NULL,
    todo_count INTEGER NOT NULL DEFAULT 0,
    issue_count INTEGER NOT NULL DEFAULT 0,
    blocked_count INTEGER NOT NULL DEFAULT 0,
    summary TEXT,
    extracted_json JSONB,
    model_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_project_members_team_id ON project_members(team_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_member_id ON documents(uploaded_by_member_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_project_id ON document_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_faiss_indexes_project_id ON faiss_indexes(project_id);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_faiss_index_id ON chunk_embeddings(faiss_index_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_project_id ON embedding_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_document_id ON embedding_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_faiss_index_id ON embedding_jobs(faiss_index_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX IF NOT EXISTS idx_todos_project_status ON todos(project_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_project_approval ON todos(project_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_todos_assignee_member_id ON todos(assignee_member_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_at ON todos(due_at);
CREATE INDEX IF NOT EXISTS idx_todos_source_chunk_id ON todos(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_status ON issues(project_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_project_severity ON issues(project_id, severity);
CREATE INDEX IF NOT EXISTS idx_issues_project_approval ON issues(project_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_issues_source_chunk_id ON issues(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_issue_history_issue_id ON issue_history(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_history_changed_by_member_id ON issue_history(changed_by_member_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_starts_at ON calendar_events(project_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_member_id ON calendar_events(member_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_project_week ON weekly_reports(project_id, week_start);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_project_month ON monthly_reports(project_id, month_start);
CREATE INDEX IF NOT EXISTS idx_handoff_reports_project_created ON handoff_reports(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_created ON chat_messages(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_member_id ON chat_messages(member_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_project_id ON ai_summaries(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_summaries_document_id ON ai_summaries(document_id);