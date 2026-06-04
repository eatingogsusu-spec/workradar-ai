CREATE SCHEMA IF NOT EXISTS opsradar2;
SET search_path TO opsradar2, public;

-- OpsRadar2 latest dummy seed for the current ERD/schema.
-- The values are ASCII-only to avoid console encoding corruption on Windows.
-- It is safe to re-run because fixed IDs are upserted.

INSERT INTO teams (id, name, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'AZAG', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

INSERT INTO users (id, team_id, name, email, role, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Project Manager', 'pm@azag.dev', 'pm', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'AI Engineer', 'ai@azag.dev', 'ai', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Infra Engineer', 'infra@azag.dev', 'infra', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'Backend Engineer', 'backend@azag.dev', 'backend', NOW(), NOW()),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'Frontend Engineer', 'frontend@azag.dev', 'frontend', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  updated_at = NOW();

INSERT INTO projects (id, team_id, name, description, status, created_at, updated_at) VALUES
  (
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'OpsRadar MVP',
    'AI operations radar for project handoff, risk detection, todo tracking, issue tracking, and schedule awareness.',
    'active',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  team_id = EXCLUDED.team_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO project_members (id, team_id, project_id, user_id, role, status, joined_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'admin', 'active', NOW()),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'member', 'active', NOW()),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member', 'active', NOW()),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000004', 'member', 'active', NOW()),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000005', 'member', 'active', NOW())
ON CONFLICT ON CONSTRAINT uq_project_members_project_user DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status;

INSERT INTO documents (
  id, project_id, uploaded_by_member_id, file_name, file_type, mime_type,
  storage_uri, content_hash, analysis_status, progress, created_at, updated_at
) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'meeting_notes_2026_05_05_kickoff.txt', 'meeting', 'text/plain', '/storage/docs/meeting_notes_2026_05_05_kickoff.txt', 'seed-doc-001', 'completed', 100, '2026-05-05 10:00:00+09', NOW()),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'chat_logs_2026_05_14_ai_pipeline.txt', 'chat', 'text/plain', '/storage/docs/chat_logs_2026_05_14_ai_pipeline.txt', 'seed-doc-002', 'completed', 100, '2026-05-14 09:00:00+09', NOW()),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'issue_log_2026_05_14_backend_api.txt', 'issue_log', 'text/plain', '/storage/docs/issue_log_2026_05_14_backend_api.txt', 'seed-doc-003', 'completed', 100, '2026-05-14 11:00:00+09', NOW())
ON CONFLICT (id) DO UPDATE SET
  uploaded_by_member_id = EXCLUDED.uploaded_by_member_id,
  file_name = EXCLUDED.file_name,
  file_type = EXCLUDED.file_type,
  mime_type = EXCLUDED.mime_type,
  storage_uri = EXCLUDED.storage_uri,
  content_hash = EXCLUDED.content_hash,
  analysis_status = EXCLUDED.analysis_status,
  progress = EXCLUDED.progress,
  updated_at = NOW();

INSERT INTO document_chunks (
  id, document_id, project_id, chunk_index, content, token_count, content_hash, page_number, section_title, created_at
) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 0, 'Kickoff confirmed the 8 week MVP plan. Backend owns API contracts, AI owns RAG pipeline, frontend owns React screens, infra owns Azure PostgreSQL.', 24, 'seed-chunk-001', 1, 'kickoff', '2026-05-05 10:30:00+09'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 0, 'AI pipeline is connected to parsing, chunking, FAISS indexing, and fallback answers. Timeout handling and retrieval accuracy still need tuning.', 22, 'seed-chunk-002', 1, 'ai_pipeline', '2026-05-14 09:30:00+09'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 0, 'Todo and issue API endpoints must match the current ERD. due_at is the canonical due date column. Frontend integration depends on stable response fields.', 25, 'seed-chunk-003', 1, 'backend_api', '2026-05-14 11:30:00+09')
ON CONFLICT ON CONSTRAINT uq_document_chunks_document_index DO UPDATE SET
  content = EXCLUDED.content,
  token_count = EXCLUDED.token_count,
  content_hash = EXCLUDED.content_hash,
  page_number = EXCLUDED.page_number,
  section_title = EXCLUDED.section_title;

INSERT INTO faiss_indexes (
  id, project_id, index_path, embedding_model, embedding_dimension, version, status, created_at, activated_at
) VALUES
  ('fa000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'data/faiss/index.faiss', 'text-embedding-3-large', 3072, 1, 'active', NOW(), NOW())
ON CONFLICT ON CONSTRAINT uq_faiss_indexes_project_version DO UPDATE SET
  index_path = EXCLUDED.index_path,
  embedding_model = EXCLUDED.embedding_model,
  embedding_dimension = EXCLUDED.embedding_dimension,
  status = EXCLUDED.status,
  activated_at = NOW();

INSERT INTO chunk_embeddings (
  id, chunk_id, faiss_index_id, vector_external_id, embedding_model, embedding_dimension, created_at
) VALUES
  ('0e000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 0, 'text-embedding-3-large', 3072, NOW()),
  ('0e000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000001', 1, 'text-embedding-3-large', 3072, NOW()),
  ('0e000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000001', 2, 'text-embedding-3-large', 3072, NOW())
ON CONFLICT ON CONSTRAINT uq_chunk_embeddings_index_vector DO UPDATE SET
  chunk_id = EXCLUDED.chunk_id,
  embedding_model = EXCLUDED.embedding_model,
  embedding_dimension = EXCLUDED.embedding_dimension;

INSERT INTO issues (
  id, project_id, assignee_member_id, reporter_member_id, source_document_id, source_chunk_id,
  title, description, severity, status, source_type, approval_status, confidence_score,
  is_candidate, risk_reason, domino_chain, due_at, created_at, updated_at
) VALUES
  ('80000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Azure OpenAI timeout blocks reliable AI answers', 'AI responses can fail when Azure OpenAI is slow. Add retry, timeout, and deterministic fallback.', 'high', 'in_progress', 'ai', 'approved', 92, false, 'Timeout can make the assistant look broken during demo.', 'AI answer failure -> todo extraction delay -> frontend demo risk', '2026-06-10 18:00:00+09', '2026-05-14 12:00:00+09', NOW()),
  ('80000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'Todo API and frontend contract mismatch', 'The backend must return fields that the React frontend expects, including due_at and status.', 'medium', 'open', 'manual', 'approved', NULL, false, 'Frontend screens may show empty data if field names drift.', 'API drift -> frontend bug -> demo confusion', '2026-06-12 18:00:00+09', '2026-05-14 13:00:00+09', NOW()),
  ('80000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', NULL, 'd0000000-0000-0000-0000-000000000003', NULL, NULL, 'Database backup plan not confirmed', 'Confirm backup and restore process for Azure PostgreSQL before team demo data grows.', 'medium', 'open', 'manual', 'pending', 60, true, 'Data loss would block demo recovery.', 'No backup -> failed recovery -> lost seed/demo data', '2026-06-14 18:00:00+09', '2026-05-15 10:00:00+09', NOW())
ON CONFLICT (id) DO UPDATE SET
  assignee_member_id = EXCLUDED.assignee_member_id,
  reporter_member_id = EXCLUDED.reporter_member_id,
  source_document_id = EXCLUDED.source_document_id,
  source_chunk_id = EXCLUDED.source_chunk_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  severity = EXCLUDED.severity,
  status = EXCLUDED.status,
  source_type = EXCLUDED.source_type,
  approval_status = EXCLUDED.approval_status,
  confidence_score = EXCLUDED.confidence_score,
  is_candidate = EXCLUDED.is_candidate,
  risk_reason = EXCLUDED.risk_reason,
  domino_chain = EXCLUDED.domino_chain,
  due_at = EXCLUDED.due_at,
  updated_at = NOW();

INSERT INTO todos (
  id, project_id, assignee_member_id, created_by_member_id, reviewed_by_member_id,
  source_document_id, source_chunk_id, linked_issue_id, title, description, status,
  priority, source_type, approval_status, confidence_score, due_at, created_at, updated_at
) VALUES
  ('70000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', NULL, 'e0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', 'Add Azure OpenAI retry and fallback path', 'Make assistant answers stable even when Azure OpenAI is slow or unavailable.', 'in_progress', 'high', 'ai', 'approved', 91, '2026-06-10 18:00:00+09', '2026-05-14 12:00:00+09', NOW()),
  ('70000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', NULL, 'e0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', 'Verify Todo and Issue response fields for React', 'Check that frontend can render id, title, status, priority, assignee, due_at, and related issue data.', 'pending', 'high', 'manual', 'approved', NULL, '2026-06-12 18:00:00+09', '2026-05-14 13:30:00+09', NOW()),
  ('70000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL, 'Build React API integration smoke screen', 'Create a small screen that calls health, todos, issues, calendar, and assistant APIs.', 'pending', 'medium', 'manual', 'approved', NULL, '2026-06-13 18:00:00+09', '2026-05-15 09:00:00+09', NOW()),
  ('70000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, '80000000-0000-0000-0000-000000000003', 'Confirm PostgreSQL backup and restore procedure', 'Document how to restore azag_db for demo recovery.', 'blocked', 'medium', 'manual', 'pending', 60, '2026-06-14 18:00:00+09', '2026-05-15 10:30:00+09', NOW()),
  ('70000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', NULL, 'Kickoff architecture decision recorded', 'Architecture baseline has been confirmed from kickoff notes.', 'completed', 'medium', 'ai', 'approved', 88, '2026-05-09 18:00:00+09', '2026-05-05 11:00:00+09', NOW())
ON CONFLICT (id) DO UPDATE SET
  assignee_member_id = EXCLUDED.assignee_member_id,
  created_by_member_id = EXCLUDED.created_by_member_id,
  reviewed_by_member_id = EXCLUDED.reviewed_by_member_id,
  source_document_id = EXCLUDED.source_document_id,
  source_chunk_id = EXCLUDED.source_chunk_id,
  linked_issue_id = EXCLUDED.linked_issue_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  source_type = EXCLUDED.source_type,
  approval_status = EXCLUDED.approval_status,
  confidence_score = EXCLUDED.confidence_score,
  due_at = EXCLUDED.due_at,
  updated_at = NOW();

INSERT INTO issue_history (id, issue_id, status, changed_by_member_id, note, created_at) VALUES
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'in_progress', 'd0000000-0000-0000-0000-000000000002', 'AI fallback implementation started.', '2026-05-14 12:10:00+09'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'open', 'd0000000-0000-0000-0000-000000000004', 'API contract drift reported from frontend integration.', '2026-05-14 13:10:00+09')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  changed_by_member_id = EXCLUDED.changed_by_member_id,
  note = EXCLUDED.note;

INSERT INTO calendar_events (
  id, project_id, member_id, source_chunk_id, event_type, title, source_type,
  approval_status, starts_at, ends_at, created_at
) VALUES
  ('82000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'meeting', 'OpsRadar kickoff meeting', 'ai', 'approved', '2026-05-05 10:00:00+09', '2026-05-05 11:00:00+09', '2026-05-05 09:30:00+09'),
  ('82000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'deadline', 'Azure OpenAI fallback deadline', 'ai', 'approved', '2026-06-10 18:00:00+09', NULL, '2026-05-14 12:00:00+09'),
  ('82000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000003', 'milestone', 'React API contract checkpoint', 'manual', 'approved', '2026-06-12 15:00:00+09', NULL, '2026-05-15 09:00:00+09'),
  ('82000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL, 'meeting', 'Demo rehearsal', 'manual', 'approved', '2026-06-17 10:00:00+09', '2026-06-17 11:00:00+09', '2026-05-15 09:30:00+09')
ON CONFLICT (id) DO UPDATE SET
  member_id = EXCLUDED.member_id,
  source_chunk_id = EXCLUDED.source_chunk_id,
  event_type = EXCLUDED.event_type,
  title = EXCLUDED.title,
  source_type = EXCLUDED.source_type,
  approval_status = EXCLUDED.approval_status,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

INSERT INTO weekly_reports (
  id, project_id, created_by_member_id, week_start, week_end, content, progress_rate, created_at
) VALUES
  ('90000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '2026-05-05', '2026-05-09', 'Week 1: kickoff completed, core ownership assigned, Azure PostgreSQL prepared, backend API contract drafted.', 20, '2026-05-09 18:00:00+09'),
  ('90000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '2026-05-12', '2026-05-16', 'Week 2: AI pipeline connected, todo and issue contract checked, frontend integration risk identified.', 45, '2026-05-16 18:00:00+09')
ON CONFLICT ON CONSTRAINT uq_weekly_reports_project_week DO UPDATE SET
  content = EXCLUDED.content,
  progress_rate = EXCLUDED.progress_rate,
  created_by_member_id = EXCLUDED.created_by_member_id;

INSERT INTO monthly_reports (
  id, project_id, created_by_member_id, month_start, month_end, content, progress_rate, created_at
) VALUES
  ('91000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '2026-05-01', '2026-05-31', 'May summary: backend schema, document analysis pipeline, AI assistant fallback, and frontend API contract baseline are ready for integration.', 45, '2026-05-31 18:00:00+09')
ON CONFLICT ON CONSTRAINT uq_monthly_reports_project_month DO UPDATE SET
  content = EXCLUDED.content,
  progress_rate = EXCLUDED.progress_rate,
  created_by_member_id = EXCLUDED.created_by_member_id;

INSERT INTO handoff_reports (
  id, project_id, from_member_id, to_member_id, handoff_type, content, created_at
) VALUES
  ('92000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'general', 'Current handoff: keep schema aligned with React frontend, verify assistant answers from todos/issues/calendar, and protect database seed data for demos.', '2026-05-14 17:00:00+09')
ON CONFLICT (id) DO UPDATE SET
  from_member_id = EXCLUDED.from_member_id,
  to_member_id = EXCLUDED.to_member_id,
  handoff_type = EXCLUDED.handoff_type,
  content = EXCLUDED.content;

INSERT INTO chat_messages (
  id, project_id, member_id, role, content, sources_json, model_name, created_at
) VALUES
  ('93000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'user', 'What unfinished todos are risky?', NULL, 'manual-seed', '2026-05-14 13:00:00+09'),
  ('93000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assistant', 'High priority unfinished todos are Azure OpenAI fallback, API response field verification, and React API smoke screen.', '["chat_logs_2026_05_14_ai_pipeline.txt", "issue_log_2026_05_14_backend_api.txt"]'::jsonb, 'manual-seed', '2026-05-14 13:00:05+09')
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  sources_json = EXCLUDED.sources_json,
  model_name = EXCLUDED.model_name;

INSERT INTO ai_summaries (
  id, document_id, project_id, source_faiss_index_id, todo_count, issue_count,
  blocked_count, summary, extracted_json, model_name, created_at
) VALUES
  (
    '94000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000001',
    'fa000000-0000-0000-0000-000000000001',
    2,
    1,
    0,
    'AI pipeline summary: parsing, chunking, FAISS metadata, and fallback answers are connected. Timeout handling remains the main risk.',
    '{"todos":["Add Azure OpenAI retry and fallback path","Verify retrieval quality"],"issues":["Azure OpenAI timeout blocks reliable AI answers"]}'::jsonb,
    'manual-seed',
    '2026-05-14 14:00:00+09'
  )
ON CONFLICT (id) DO UPDATE SET
  todo_count = EXCLUDED.todo_count,
  issue_count = EXCLUDED.issue_count,
  blocked_count = EXCLUDED.blocked_count,
  summary = EXCLUDED.summary,
  extracted_json = EXCLUDED.extracted_json,
  model_name = EXCLUDED.model_name;

-- Extra rows restored from origin/dummy and converted to the latest ERD.

INSERT INTO documents (
  id, project_id, uploaded_by_member_id, file_name, file_type, mime_type,
  storage_uri, content_hash, analysis_status, progress, created_at, updated_at
) VALUES
  ('e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'chat_logs_2026_05_14_ai_pipeline_full.txt', 'chat', 'text/plain', '/storage/docs/chat_logs_2026_05_14_ai_pipeline_full.txt', 'seed-doc-004', 'completed', 100, '2026-05-14 09:00:00+09', NOW()),
  ('e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'issue_log_2026_05_14_azure_timeout.txt', 'issue_log', 'text/plain', '/storage/docs/issue_log_2026_05_14_azure_timeout.txt', 'seed-doc-005', 'completed', 100, '2026-05-14 11:00:00+09', NOW())
ON CONFLICT (id) DO UPDATE SET
  uploaded_by_member_id = EXCLUDED.uploaded_by_member_id,
  file_name = EXCLUDED.file_name,
  file_type = EXCLUDED.file_type,
  mime_type = EXCLUDED.mime_type,
  storage_uri = EXCLUDED.storage_uri,
  content_hash = EXCLUDED.content_hash,
  analysis_status = EXCLUDED.analysis_status,
  progress = EXCLUDED.progress,
  updated_at = NOW();

INSERT INTO document_chunks (
  id, document_id, project_id, chunk_index, content, token_count, content_hash, page_number, section_title, created_at
) VALUES
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 1, 'Frontend layout is ready. The sidebar has seven menus. API integration needs a stable contract before React screens are connected.', 21, 'seed-chunk-004', 1, 'frontend_chat', '2026-05-12 14:30:00+09'),
  ('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 1, 'Week 2 meeting: backend API skeleton is complete, Azure VM is ready, frontend layout is complete, and RAG FAISS integration is more complex than expected.', 25, 'seed-chunk-005', 1, 'week2_meeting', '2026-05-12 18:30:00+09'),
  ('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 0, 'FAISS index save and load are implemented. Azure OpenAI API timeout continues to happen. Batch size and timeout settings need review.', 22, 'seed-chunk-006', 1, 'ai_timeout', '2026-05-14 09:30:00+09'),
  ('f0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 1, 'RAG retrieval accuracy is lower than expected. Chunk size and prompt model selection should be reviewed before demo.', 18, 'seed-chunk-007', 1, 'rag_accuracy', '2026-05-14 09:30:00+09'),
  ('f0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 0, 'Issue log: Azure OpenAI responses exceed 5 seconds and fail often. Estimated failure rate is around 30 percent. Add retry and fallback logic.', 23, 'seed-chunk-008', 1, 'azure_timeout_issue', '2026-05-14 11:30:00+09')
ON CONFLICT ON CONSTRAINT uq_document_chunks_document_index DO UPDATE SET
  content = EXCLUDED.content,
  token_count = EXCLUDED.token_count,
  content_hash = EXCLUDED.content_hash,
  page_number = EXCLUDED.page_number,
  section_title = EXCLUDED.section_title;

INSERT INTO chunk_embeddings (
  id, chunk_id, faiss_index_id, vector_external_id, embedding_model, embedding_dimension, created_at
) VALUES
  ('0e000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-000000000001', 3, 'text-embedding-3-large', 3072, NOW()),
  ('0e000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000005', 'fa000000-0000-0000-0000-000000000001', 4, 'text-embedding-3-large', 3072, NOW()),
  ('0e000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000006', 'fa000000-0000-0000-0000-000000000001', 5, 'text-embedding-3-large', 3072, NOW()),
  ('0e000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000007', 'fa000000-0000-0000-0000-000000000001', 6, 'text-embedding-3-large', 3072, NOW()),
  ('0e000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000008', 'fa000000-0000-0000-0000-000000000001', 7, 'text-embedding-3-large', 3072, NOW())
ON CONFLICT ON CONSTRAINT uq_chunk_embeddings_index_vector DO UPDATE SET
  chunk_id = EXCLUDED.chunk_id,
  embedding_model = EXCLUDED.embedding_model,
  embedding_dimension = EXCLUDED.embedding_dimension;

INSERT INTO issues (
  id, project_id, assignee_member_id, reporter_member_id, source_document_id, source_chunk_id,
  title, description, severity, status, source_type, approval_status, confidence_score,
  is_candidate, risk_reason, domino_chain, due_at, created_at, updated_at
) VALUES
  ('80000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', NULL, 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000007', 'FAISS index backup policy is missing', 'The project needs a backup policy for FAISS index files and metadata.', 'medium', 'open', 'ai', 'pending', 62, true, 'Index loss can reduce AI answer quality.', 'No backup -> index rebuild delay -> assistant demo risk', '2026-06-15 18:00:00+09', '2026-05-14 12:00:00+09', NOW()),
  ('80000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Azure VM PostgreSQL connection issue resolved', 'asyncpg driver and connection settings were fixed during initial setup.', 'medium', 'resolved', 'manual', 'approved', NULL, false, 'Resolved infra issue kept for history.', 'Connection issue -> backend startup failure -> resolved', '2026-05-09 18:00:00+09', '2026-05-06 10:00:00+09', NOW())
ON CONFLICT (id) DO UPDATE SET
  assignee_member_id = EXCLUDED.assignee_member_id,
  reporter_member_id = EXCLUDED.reporter_member_id,
  source_document_id = EXCLUDED.source_document_id,
  source_chunk_id = EXCLUDED.source_chunk_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  severity = EXCLUDED.severity,
  status = EXCLUDED.status,
  source_type = EXCLUDED.source_type,
  approval_status = EXCLUDED.approval_status,
  confidence_score = EXCLUDED.confidence_score,
  is_candidate = EXCLUDED.is_candidate,
  risk_reason = EXCLUDED.risk_reason,
  domino_chain = EXCLUDED.domino_chain,
  due_at = EXCLUDED.due_at,
  updated_at = NOW();

INSERT INTO todos (
  id, project_id, assignee_member_id, created_by_member_id, reviewed_by_member_id,
  source_document_id, source_chunk_id, linked_issue_id, title, description, status,
  priority, source_type, approval_status, confidence_score, due_at, created_at, updated_at
) VALUES
  ('70000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL, 'Prepare week 3 meeting materials', 'Prepare the week 3 status meeting material and agenda.', 'pending', 'medium', 'manual', 'approved', NULL, '2026-06-17 10:00:00+09', '2026-05-14 09:00:00+09', NOW()),
  ('70000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', NULL, NULL, NULL, NULL, 'Reflect monthly reports and FAISS columns in ERD', 'Update ERD with monthly reports and FAISS related columns.', 'pending', 'medium', 'manual', 'approved', NULL, '2026-06-16 18:00:00+09', '2026-05-14 10:00:00+09', NOW()),
  ('70000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', NULL, 'd0000000-0000-0000-0000-000000000001', NULL, 'e0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000004', 'Review FAISS index backup policy', 'Review and approve backup policy for FAISS index files.', 'pending', 'low', 'ai', 'pending', 62, NULL, '2026-05-14 12:00:00+09', NOW())
ON CONFLICT (id) DO UPDATE SET
  assignee_member_id = EXCLUDED.assignee_member_id,
  created_by_member_id = EXCLUDED.created_by_member_id,
  reviewed_by_member_id = EXCLUDED.reviewed_by_member_id,
  source_document_id = EXCLUDED.source_document_id,
  source_chunk_id = EXCLUDED.source_chunk_id,
  linked_issue_id = EXCLUDED.linked_issue_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  source_type = EXCLUDED.source_type,
  approval_status = EXCLUDED.approval_status,
  confidence_score = EXCLUDED.confidence_score,
  due_at = EXCLUDED.due_at,
  updated_at = NOW();

INSERT INTO issue_history (id, issue_id, status, changed_by_member_id, note, created_at) VALUES
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004', 'open', 'd0000000-0000-0000-0000-000000000002', 'AI detected missing FAISS backup policy.', '2026-05-14 12:10:00+09'),
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000005', 'resolved', 'd0000000-0000-0000-0000-000000000003', 'asyncpg install and connection settings completed.', '2026-05-08 15:00:00+09')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  changed_by_member_id = EXCLUDED.changed_by_member_id,
  note = EXCLUDED.note;

INSERT INTO calendar_events (
  id, project_id, member_id, source_chunk_id, event_type, title, source_type,
  approval_status, starts_at, ends_at, created_at
) VALUES
  ('82000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', NULL, 'deadline', 'ERD update deadline', 'manual', 'approved', '2026-06-16 18:00:00+09', NULL, '2026-05-14 10:00:00+09'),
  ('82000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', NULL, 'f0000000-0000-0000-0000-000000000006', 'deadline', 'FAISS backup policy review', 'ai', 'pending', '2026-06-15 18:00:00+09', NULL, '2026-05-14 12:00:00+09')
ON CONFLICT (id) DO UPDATE SET
  member_id = EXCLUDED.member_id,
  source_chunk_id = EXCLUDED.source_chunk_id,
  event_type = EXCLUDED.event_type,
  title = EXCLUDED.title,
  source_type = EXCLUDED.source_type,
  approval_status = EXCLUDED.approval_status,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

INSERT INTO chat_messages (
  id, project_id, member_id, role, content, sources_json, model_name, created_at
) VALUES
  ('93000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'user', 'What are the current high risk issues?', NULL, 'manual-seed', '2026-05-14 13:01:00+09'),
  ('93000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assistant', 'The high risk issue is Azure OpenAI timeout. It can make AI assistant responses fail during demo.', '["issue_log_2026_05_14_azure_timeout.txt"]'::jsonb, 'manual-seed', '2026-05-14 13:01:05+09'),
  ('93000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'user', 'What schedule is coming up?', NULL, 'manual-seed', '2026-05-14 13:02:00+09'),
  ('93000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'assistant', 'Upcoming items include Azure fallback deadline, ERD update deadline, FAISS backup policy review, and demo rehearsal.', '["calendar_events"]'::jsonb, 'manual-seed', '2026-05-14 13:02:05+09')
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  sources_json = EXCLUDED.sources_json,
  model_name = EXCLUDED.model_name;

INSERT INTO ai_summaries (
  id, document_id, project_id, source_faiss_index_id, todo_count, issue_count,
  blocked_count, summary, extracted_json, model_name, created_at
) VALUES
  (
    '94000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000005',
    'c0000000-0000-0000-0000-000000000001',
    'fa000000-0000-0000-0000-000000000001',
    1,
    2,
    0,
    'Issue log summary: Azure timeout and FAISS backup policy are important risks. The assistant should rely on DB context if model calls fail.',
    '{"todos":["Review FAISS index backup policy"],"issues":["Azure OpenAI timeout blocks reliable AI answers","FAISS index backup policy is missing"]}'::jsonb,
    'manual-seed',
    '2026-05-14 14:05:00+09'
  )
ON CONFLICT (id) DO UPDATE SET
  todo_count = EXCLUDED.todo_count,
  issue_count = EXCLUDED.issue_count,
  blocked_count = EXCLUDED.blocked_count,
  summary = EXCLUDED.summary,
  extracted_json = EXCLUDED.extracted_json,
  model_name = EXCLUDED.model_name;

-- Korean content restored from origin/dummy.

UPDATE users AS u SET
  name = v.name,
  email = v.email,
  role = v.role,
  updated_at = NOW()
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000001'::uuid, '김희진', 'heejin@azag.dev', 'pm'),
  ('b0000000-0000-0000-0000-000000000002'::uuid, '이성우', 'sungwoo@azag.dev', 'ai'),
  ('b0000000-0000-0000-0000-000000000003'::uuid, '김예은', 'yeeun@azag.dev', 'infra'),
  ('b0000000-0000-0000-0000-000000000004'::uuid, '김성호', 'sungho@azag.dev', 'backend'),
  ('b0000000-0000-0000-0000-000000000005'::uuid, '박주원', 'juwon@azag.dev', 'frontend')
) AS v(id, name, email, role)
WHERE u.id = v.id;

UPDATE projects
SET description = 'AZAG팀이 OpsRadar를 개발하는 과정을 OpsRadar 자체로 분석하는 셀프 운영 기록',
    updated_at = NOW()
WHERE id = 'c0000000-0000-0000-0000-000000000001';

UPDATE document_chunks AS dc SET
  content = v.content,
  token_count = v.token_count,
  section_title = v.section_title
FROM (VALUES
  ('f0000000-0000-0000-0000-000000000001'::uuid, $$2026-05-05 킥오프 회의. 참석: 김희진(PM), 이성우(AI), 김예은(인프라), 김성호(백엔드), 박주원(프론트). 프로젝트명 OpsRadar로 확정. 8주 MVP 일정 합의. 기술스택: FastAPI + PostgreSQL + FAISS + React.$$::text, 31, '킥오프 회의록'),
  ('f0000000-0000-0000-0000-000000000002'::uuid, $$1주차 주요 액션아이템: 김성호 - DB 스키마 설계 및 기본 API 껍데기 구현. 이성우 - RAG 파이프라인 설계 시작. 김예은 - Azure VM 및 PostgreSQL 환경 세팅. 박주원 - React 프로젝트 초기화 및 레이아웃 구성.$$::text, 30, '1주차 액션아이템'),
  ('f0000000-0000-0000-0000-000000000003'::uuid, $$김성호: documents API 엔드포인트 완성했습니다. POST /api/v1/documents/upload 동작 확인. 김희진: todos API도 이번 주 안에 껍데기라도 올려주세요. 김성호: 네 오늘 중으로 올리겠습니다.$$::text, 26, '2주차 백엔드 채팅'),
  ('f0000000-0000-0000-0000-000000000004'::uuid, $$박주원: 프론트 레이아웃 완성. 사이드바 7개 메뉴 구현. 근데 API 명세서 기준으로 연동하면 되는거죠? 김희진: 맞아요 노션 API 명세서 참고하면 됩니다. 박주원: 확인했습니다. 업로드 UI부터 시작하겠습니다.$$::text, 27, '2주차 프론트 채팅'),
  ('f0000000-0000-0000-0000-000000000005'::uuid, $$2주차 회의 (2026-05-12). 진행상황: 백엔드 API 껍데기 완성(김성호), Azure VM 세팅 완료(김예은), 프론트 레이아웃 완성(박주원). 이슈: RAG 파이프라인 FAISS 연동 예상보다 복잡. 이성우 추가 시간 필요.$$::text, 28, '2주차 회의록'),
  ('f0000000-0000-0000-0000-000000000006'::uuid, $$이성우: FAISS 인덱스 저장/로드 구현 완료. 근데 Azure OpenAI API 타임아웃이 계속 발생합니다. 5초 이상 지연 케이스가 늘고 있어요. 김성호: 혹시 배치 사이즈 문제 아닐까요? 이성우: 확인해볼게요.$$::text, 29, 'AI 파이프라인 타임아웃'),
  ('f0000000-0000-0000-0000-000000000007'::uuid, $$이성우: RAG 검색 정확도가 예상보다 낮습니다. 청크 사이즈를 줄여봤는데도 관련 없는 결과가 섞여요. 임베딩 모델 교체를 고려해봐야 할 것 같습니다. 희진님 확인 부탁드려요.$$::text, 24, 'RAG 검색 정확도'),
  ('f0000000-0000-0000-0000-000000000008'::uuid, $$[이슈 로그 2026-05-14] Azure OpenAI API 응답 지연 5초 초과. 발생 빈도: 오전 기준 약 30%. 원인 추정: 토큰 한도 근접 또는 리전 부하. 담당: 이성우. 임시 조치: 재시도 로직 추가 필요.$$::text, 31, 'Azure timeout 이슈 로그')
) AS v(id, content, token_count, section_title)
WHERE dc.id = v.id;

UPDATE todos AS t SET
  title = v.title,
  description = v.description,
  updated_at = NOW()
FROM (VALUES
  ('70000000-0000-0000-0000-000000000001'::uuid, 'Azure OpenAI API 타임아웃 원인 분석 및 재시도 로직 구현', 'Azure OpenAI API 응답 지연 원인을 분석하고 재시도 로직을 구현한다.'),
  ('70000000-0000-0000-0000-000000000002'::uuid, 'RAG 검색 정확도 개선 — 청크 사이즈 및 임베딩 모델 재검토', 'RAG 검색 정확도 개선을 위해 청크 사이즈와 임베딩 모델을 재검토한다.'),
  ('70000000-0000-0000-0000-000000000003'::uuid, 'todos API 엔드포인트 비즈니스 로직 구현', 'todos API 엔드포인트의 비즈니스 로직을 구현한다.'),
  ('70000000-0000-0000-0000-000000000004'::uuid, '파일 업로드 UI — API 연동 및 분석 상태 표시 구현', '파일 업로드 UI에서 API 연동 및 분석 상태 표시를 구현한다.'),
  ('70000000-0000-0000-0000-000000000005'::uuid, 'Azure VM PostgreSQL 환경 세팅 완료 확인', 'Azure VM PostgreSQL 환경 세팅 완료 여부를 확인한다.'),
  ('70000000-0000-0000-0000-000000000006'::uuid, '3주차 팀 미팅 자료 준비 및 진행', '3주차 팀 미팅 자료를 준비하고 진행한다.'),
  ('70000000-0000-0000-0000-000000000007'::uuid, 'ERDCloud 수정 — monthly_reports 추가 및 FAISS 컬럼 반영', 'ERDCloud에 monthly_reports와 FAISS 관련 컬럼을 반영한다.'),
  ('70000000-0000-0000-0000-000000000008'::uuid, 'FAISS 인덱스 파일 백업 정책 수립', 'FAISS 인덱스 파일 백업 정책을 수립한다.')
) AS v(id, title, description)
WHERE t.id = v.id;

UPDATE issues AS i SET
  title = v.title,
  description = v.description,
  risk_reason = v.risk_reason,
  domino_chain = v.domino_chain,
  updated_at = NOW()
FROM (VALUES
  ('80000000-0000-0000-0000-000000000001'::uuid, 'Azure OpenAI API 타임아웃 이슈 — 응답 지연 5초 초과 빈발', 'Azure OpenAI API 응답 지연 5초 초과가 빈발하고 있다.', 'AI Assistant 응답 실패 및 시연 리스크가 발생할 수 있다.', 'Azure timeout → AI 답변 실패 → Todo/Issue 추출 지연 → 시연 리스크'),
  ('80000000-0000-0000-0000-000000000002'::uuid, 'RAG 검색 정확도 Blocked — 관련 없는 청크 혼입 문제', 'RAG 검색 결과에 관련 없는 청크가 혼입되는 문제가 있다.', 'AI 답변 신뢰도가 낮아질 수 있다.', '검색 정확도 저하 → 잘못된 요약 → 잘못된 Todo/Issue 추천'),
  ('80000000-0000-0000-0000-000000000003'::uuid, 'Dashboard API 집계 쿼리 미구현 — 3주차 연동 지연 가능성', 'Dashboard API 집계 쿼리가 아직 구현되지 않았다.', '프론트 Dashboard 연동이 지연될 수 있다.', '집계 API 지연 → Dashboard 빈 화면 → 시연 완성도 저하'),
  ('80000000-0000-0000-0000-000000000004'::uuid, 'FAISS 인덱스 파일 백업 정책 미수립 — 데이터 유실 위험', 'FAISS 인덱스 파일 백업 정책이 아직 수립되지 않았다.', '인덱스 유실 시 RAG 검색 품질 복구가 지연된다.', '백업 없음 → 인덱스 유실 → 재색인 지연 → Assistant 품질 저하'),
  ('80000000-0000-0000-0000-000000000005'::uuid, 'Azure VM PostgreSQL 연결 설정 오류 — asyncpg 드라이버 미설치', 'Azure VM PostgreSQL 연결 설정 오류가 있었고 asyncpg 드라이버 설치로 해결되었다.', '해결된 인프라 이슈로 이력 관리 목적이다.', '드라이버 누락 → DB 연결 실패 → 백엔드 기동 실패 → 해결')
) AS v(id, title, description, risk_reason, domino_chain)
WHERE i.id = v.id;

UPDATE weekly_reports AS wr SET
  content = v.content,
  progress_rate = v.progress_rate
FROM (VALUES
  ('90000000-0000-0000-0000-000000000001'::uuid, $$## 1주차 운영 보고서

**개요**
킥오프 완료. 기술스택 및 역할 확정. 환경 세팅 시작.

**주요 완료 사항**
- 프로젝트 킥오프 및 역할 분담 확정
- Azure VM PostgreSQL 환경 세팅 완료 (김예은)
- 프로젝트 폴더 구조 확정 및 GitHub dev 브랜치 생성

**이슈**
- Azure VM PostgreSQL 연결 오류 발생 → asyncpg 드라이버 누락으로 확인 후 해결

**다음 주 목표**
- 백엔드 API 껍데기 완성
- 프론트 레이아웃 구현
- RAG 파이프라인 설계 시작$$::text, 20),
  ('90000000-0000-0000-0000-000000000002'::uuid, $$## 2주차 운영 보고서

**개요**
API 껍데기 완성. 프론트 레이아웃 완성. RAG 파이프라인 진행 중.

**주요 완료 사항**
- 백엔드 API 엔드포인트 껍데기 전체 완성 (김성호)
- 프론트 사이드바 + 라우팅 구조 완성 (박주원)
- 파일 업로드 UI → API 연동 완성 (박주원)
- FAISS 인덱스 저장/로드 기본 구현 (이성우)

**이슈**
- Azure OpenAI API 타임아웃 빈발 (High) — 이성우 분석 중
- RAG 검색 정확도 낮음 (High) — 청크 사이즈 재검토 필요
- Dashboard 집계 API 미구현 (Medium) — 3주차로 이월

**다음 주 목표**
- Azure 타임아웃 원인 해결
- RAG 정확도 개선
- Todo API 비즈니스 로직 구현$$::text, 45)
) AS v(id, content, progress_rate)
WHERE wr.id = v.id;

UPDATE monthly_reports
SET content = $$## 5월 월간 보고서 (중간)

**진행률**: 45% (2주차 기준)

**완료된 마일스톤**
- 환경 세팅 완료
- API 전체 구조 완성
- 프론트 레이아웃 완성

**진행 중인 이슈**
- Azure OpenAI 타임아웃 해결 필요
- RAG 정확도 개선 필요

**6월 목표**
- Todo/이슈 기능 완성
- Dashboard 완성
- AI Assistant 구현$$,
    progress_rate = 45
WHERE id = '91000000-0000-0000-0000-000000000001';

UPDATE handoff_reports
SET content = $$## 현재 진행 상태

**완료된 작업**
- GitHub dev 브랜치 구조 확정
- PostgreSQL + FAISS 환경 세팅
- 전체 API 엔드포인트 껍데기 완성
- 프론트 사이드바 + 업로드 UI 완성

**진행 중인 작업**
- Azure OpenAI 타임아웃 이슈 해결 (이성우)
- RAG 검색 정확도 개선 (이성우)
- Todo API 비즈니스 로직 (김성호)

**Blocked 상태**
- Dashboard 집계 API — Todo/이슈 데이터 쌓인 후 구현 가능

**주요 참고 문서**
- 노션: DB 명세서, API 명세서, Use Case 정의서
- GitHub: yeni0224/teamAZAG dev 브랜치$$
WHERE id = '92000000-0000-0000-0000-000000000001';

UPDATE chat_messages AS cm SET
  content = v.content,
  sources_json = v.sources_json::jsonb
FROM (VALUES
  ('93000000-0000-0000-0000-000000000001'::uuid, '현재 가장 위험한 이슈는?', NULL),
  ('93000000-0000-0000-0000-000000000002'::uuid, '현재 High Risk 이슈는 2건입니다. 1) Azure OpenAI API 타임아웃 이슈 — 응답 지연 5초 초과가 빈발하고 있으며 이성우님이 분석 중입니다. 2) RAG 검색 정확도 Blocked — 관련 없는 청크가 검색 결과에 혼입되는 문제로 아직 담당자 미지정 상태입니다.', '["issue_log_20260514_azure_timeout.txt", "chat_logs_20260514_ai_pipeline.txt"]'),
  ('93000000-0000-0000-0000-000000000003'::uuid, '이번주 미완료 Todo 알려줘', NULL),
  ('93000000-0000-0000-0000-000000000004'::uuid, '이번 주 미완료 Todo는 총 4건입니다. 1) [High] Azure OpenAI API 타임아웃 원인 분석 및 재시도 로직 구현 — 이성우 (진행 중). 2) [High] RAG 검색 정확도 개선 — 이성우 (대기). 3) [High] todos API 비즈니스 로직 구현 — 김성호 (진행 중). 4) [Medium] 3주차 팀 미팅 자료 준비 — 김희진 (대기).', '["meeting_notes_20260512_week2.pdf", "chat_logs_20260514_ai_pipeline.txt"]'),
  ('93000000-0000-0000-0000-000000000005'::uuid, 'Blocked 상태 작업 알려줘', NULL),
  ('93000000-0000-0000-0000-000000000006'::uuid, 'Blocked 상태 작업은 2건입니다. 1) RAG 검색 정확도 개선 — 임베딩 모델 재검토 필요로 진행 불가 상태. 2) Dashboard 집계 API — Todo/이슈 데이터가 충분히 쌓인 후 구현 가능하여 현재 대기 중.', '["chat_logs_20260514_ai_pipeline.txt", "meeting_notes_20260512_week2.pdf"]')
) AS v(id, content, sources_json)
WHERE cm.id = v.id;

UPDATE ai_summaries AS s SET
  summary = v.summary,
  extracted_json = v.extracted_json::jsonb,
  model_name = 'manual-seed-ko'
FROM (VALUES
  ('94000000-0000-0000-0000-000000000001'::uuid, '2주차 운영 요약: API 껍데기 전체 완성. 프론트 레이아웃 완성. Azure OpenAI 타임아웃 이슈 High 발생 — 이성우 분석 중. RAG 검색 정확도 Blocked 상태. Dashboard API 3주차 이월.', '{"todos": ["Azure 타임아웃 재시도 로직", "RAG 정확도 개선", "todos API 로직 구현"], "issues": ["Azure timeout High", "RAG 정확도 Blocked"], "keywords": ["FAISS", "RAG", "Azure OpenAI", "Dashboard"]}'),
  ('94000000-0000-0000-0000-000000000002'::uuid, 'Azure OpenAI API 타임아웃 이슈 분석: 오전 기준 30% 발생률. 5초 초과 지연. 원인 추정: 토큰 한도 또는 리전 부하. 재시도 로직 추가 및 배치 사이즈 조정 권고.', '{"todos": ["재시도 로직 구현", "배치 사이즈 조정"], "issues": ["Azure timeout"], "risk_level": "high"}')
) AS v(id, summary, extracted_json)
WHERE s.id = v.id;

SELECT
  (SELECT COUNT(*) FROM teams) AS teams,
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM documents) AS documents,
  (SELECT COUNT(*) FROM document_chunks) AS document_chunks,
  (SELECT COUNT(*) FROM chunk_embeddings) AS chunk_embeddings,
  (SELECT COUNT(*) FROM todos) AS todos,
  (SELECT COUNT(*) FROM issues) AS issues,
  (SELECT COUNT(*) FROM calendar_events) AS calendar_events,
  (SELECT COUNT(*) FROM chat_messages) AS chat_messages,
  (SELECT COUNT(*) FROM ai_summaries) AS ai_summaries;
