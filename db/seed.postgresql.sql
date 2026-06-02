-- Minimal seed data aligned with the latest OpsRadar ERD schema.

INSERT INTO teams (id, name) VALUES
  ('00000000-0000-0000-0000-000000000101', 'AZAG');

INSERT INTO users (id, team_id, name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000101', 'Heejin Kim', 'heejin@azag.dev', 'admin'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000101', 'Team Member', 'member@azag.dev', 'member');

INSERT INTO projects (id, team_id, name, description, status) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'OpsRadar AI', 'AI-powered operational intelligence and handoff support for TeamAZAG.', 'active');

INSERT INTO project_members (id, team_id, project_id, user_id, role, status) VALUES
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201', 'admin', 'active'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000202', 'member', 'active');

INSERT INTO documents (id, project_id, uploaded_by_member_id, file_name, file_type, storage_uri, content_hash, status) VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'meeting_notes_20260512_week2.txt', 'txt', 'local://sample_docs/meeting_notes_20260512_week2.txt', 'seed-doc-001', 'completed');

INSERT INTO document_chunks (id, document_id, chunk_index, content, token_count, content_hash) VALUES
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000501', 0, 'OpsRadar needs dashboard, Todo approval, issue tracking, calendar events, handoff preview, reports, and AI assistant memory.', 32, 'seed-chunk-001'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000501', 1, 'The team decided to keep FAISS vectors outside PostgreSQL and store only index references in the database.', 28, 'seed-chunk-002');

INSERT INTO faiss_indexes (id, project_id, index_path, embedding_model, embedding_dimension, version, status, activated_at) VALUES
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000301', 'faiss/projects/opsradar/index.faiss', 'text-embedding-3-small', 1536, 1, 'active', now());

INSERT INTO chunk_embeddings (id, chunk_id, faiss_index_id, vector_external_id, embedding_model, embedding_dimension) VALUES
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000701', 1, 'text-embedding-3-small', 1536),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000701', 2, 'text-embedding-3-small', 1536);

INSERT INTO embedding_jobs (id, project_id, document_id, faiss_index_id, job_type, status, started_at, finished_at) VALUES
  ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000701', 'document_embedding', 'completed', now() - interval '10 minutes', now() - interval '8 minutes');

INSERT INTO todos (id, project_id, assignee_member_id, source_chunk_id, title, status, priority, source_type, approval_status, confidence_score, due_at) VALUES
  ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000601', 'Align dashboard API fields with latest ERD', 'in_progress', 'high', 'manual', 'approved', NULL, now() + interval '2 days'),
  ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000602', 'Review FAISS index backup policy', 'pending', 'medium', 'ai', 'pending', 84, now() + interval '5 days');

INSERT INTO issues (id, project_id, assignee_member_id, source_chunk_id, title, severity, status, source_type, approval_status, confidence_score) VALUES
  ('00000000-0000-0000-0000-000000001101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000602', 'FAISS index storage path must be confirmed before deployment', 'high', 'open', 'ai', 'confirmed', 88);

INSERT INTO issue_history (id, issue_id, status, changed_by_member_id, note) VALUES
  ('00000000-0000-0000-0000-000000001201', '00000000-0000-0000-0000-000000001101', 'open', '00000000-0000-0000-0000-000000000401', 'Seed issue created from latest ERD sample flow.');

INSERT INTO calendar_events (id, project_id, member_id, source_chunk_id, event_type, title, source_type, approval_status, starts_at, ends_at) VALUES
  ('00000000-0000-0000-0000-000000001301', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000601', 'meeting', 'Weekly OpsRadar sync', 'manual', 'approved', now() + interval '1 day', now() + interval '1 day 1 hour');

INSERT INTO weekly_reports (id, project_id, created_by_member_id, week_start, week_end, content, progress_rate) VALUES
  ('00000000-0000-0000-0000-000000001401', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', current_date - 7, current_date, 'Weekly report seed: schema sync, Todo review, issue tracking, and handoff readiness are in progress.', 65);

INSERT INTO monthly_reports (id, project_id, created_by_member_id, month_start, month_end, content, progress_rate) VALUES
  ('00000000-0000-0000-0000-000000001501', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'Monthly report seed for OpsRadar AI.', 42);

INSERT INTO handoff_reports (id, project_id, from_member_id, to_member_id, handoff_type, content) VALUES
  ('00000000-0000-0000-0000-000000001601', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402', 'project', 'Handoff seed: confirm FAISS storage, dashboard schema fields, and pending AI Todo approvals.');

INSERT INTO chat_messages (id, project_id, member_id, role, content) VALUES
  ('00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000401', 'user', 'What should we check before handoff?'),
  ('00000000-0000-0000-0000-000000001702', '00000000-0000-0000-0000-000000000301', NULL, 'assistant', 'Check FAISS index path, pending AI Todo approvals, high risk issues, and weekly report completeness.');

INSERT INTO ai_summaries (id, document_id, project_id, source_faiss_index_id, todo_count, issue_count, blocked_count, summary) VALUES
  ('00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000701', 2, 1, 0, 'Seed summary: latest ERD supports Todo, Issue, Calendar, Handoff, Report, Chat, and FAISS-backed RAG flows.');