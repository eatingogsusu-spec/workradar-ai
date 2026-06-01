-- Local compatibility patch for applying opsradar2/schema.sql on an existing v4-ish DB.
-- This keeps existing data and only adds columns/indexes expected by the new app.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(50) DEFAULT 'uploaded';
UPDATE documents SET analysis_status = COALESCE(analysis_status, status, 'uploaded');
ALTER TABLE documents ALTER COLUMN analysis_status SET NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
UPDATE documents SET progress = COALESCE(progress, 0);
ALTER TABLE documents ALTER COLUMN progress SET NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS project_id UUID;
UPDATE document_chunks dc
SET project_id = d.project_id
FROM documents d
WHERE dc.document_id = d.id
  AND dc.project_id IS NULL;
UPDATE document_chunks
SET project_id = (SELECT id FROM projects ORDER BY created_at LIMIT 1)
WHERE project_id IS NULL;
ALTER TABLE document_chunks ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_number INTEGER;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS section_title VARCHAR(255);

ALTER TABLE issues ADD COLUMN IF NOT EXISTS reporter_member_id UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS is_candidate BOOLEAN DEFAULT false;
UPDATE issues SET is_candidate = COALESCE(is_candidate, false);
ALTER TABLE issues ALTER COLUMN is_candidate SET NOT NULL;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS risk_reason TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS domino_chain TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

ALTER TABLE todos ADD COLUMN IF NOT EXISTS created_by_member_id UUID;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS reviewed_by_member_id UUID;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS source_document_id UUID;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS linked_issue_id UUID;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sources_json JSONB;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS model_name VARCHAR(100);

ALTER TABLE ai_summaries ADD COLUMN IF NOT EXISTS extracted_json JSONB;
ALTER TABLE ai_summaries ADD COLUMN IF NOT EXISTS model_name VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_document_chunks_project_id ON document_chunks(project_id);
CREATE INDEX IF NOT EXISTS idx_todos_source_chunk_id ON todos(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_issues_source_chunk_id ON issues(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_starts_at ON calendar_events(project_id, starts_at);
