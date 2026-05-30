-- TeamMemory seed data.
-- Run after db/schema.postgresql.sql.

INSERT INTO users (id, name, email, password_hash, role) VALUES
  ('00000000-0000-0000-0000-000000000101', 'Kim Taeho', 'taeho@teammemory.test', '$2b$12$owner.password.hash.placeholder', 'admin'),
  ('00000000-0000-0000-0000-000000000102', 'Lee Seoyeon', 'seoyeon@teammemory.test', '$2b$12$manager.password.hash.placeholder', 'member'),
  ('00000000-0000-0000-0000-000000000103', 'Park Junwoo', 'junwoo@teammemory.test', '$2b$12$member1.password.hash.placeholder', 'member'),
  ('00000000-0000-0000-0000-000000000104', 'Choi Minji', 'minji@teammemory.test', '$2b$12$member2.password.hash.placeholder', 'member'),
  ('00000000-0000-0000-0000-000000000105', 'Jung Harin', 'harin@teammemory.test', '$2b$12$viewer.password.hash.placeholder', 'member');

INSERT INTO teams (id, name) VALUES
  ('00000000-0000-0000-0000-000000000201', 'TeamMemory Product Team');

INSERT INTO projects (
  id,
  team_id,
  created_by,
  name,
  description,
  status,
  start_date,
  end_date
) VALUES (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'TeamMemory MVP',
  'AI project memory service for meetings, mail, Notion notes, todos, issues, weekly reports, briefings, and handoff documents.',
  'active',
  '2026-05-01',
  '2026-06-30'
);

INSERT INTO project_members (id, project_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'admin'),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', 'member'),
  ('00000000-0000-0000-0000-000000000313', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000103', 'member'),
  ('00000000-0000-0000-0000-000000000314', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000104', 'member'),
  ('00000000-0000-0000-0000-000000000315', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000105', 'member');

INSERT INTO documents (
  id,
  project_id,
  uploaded_by,
  file_name,
  file_type,
  source_type,
  storage_path,
  status,
  uploaded_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000102',
    'requirements-summary.pdf',
    'pdf',
    'other',
    's3://teammemory/projects/00000000-0000-0000-0000-000000000301/requirements-summary.pdf',
    'completed',
    '2026-05-11 09:30:00+09'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000103',
    'meeting-notes-2026-05-12.docx',
    'docx',
    'meeting',
    's3://teammemory/projects/00000000-0000-0000-0000-000000000301/meeting-notes-2026-05-12.docx',
    'completed',
    '2026-05-12 16:20:00+09'
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000104',
    'api-contract-draft.md',
    'md',
    'other',
    's3://teammemory/projects/00000000-0000-0000-0000-000000000301/api-contract-draft.md',
    'embedding',
    '2026-05-13 10:00:00+09'
  );

INSERT INTO document_chunks (id, document_id, project_id, content, chunk_index, page_number) VALUES
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'Dashboard must show project progress, current-week todos, delayed todos, unresolved issues, handoff score, and recent documents.', 0, 1),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', 'Documents, todos, issues, chat messages, weekly reports, and handoff reports must be scoped by project_id.', 1, 2),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', 'The team decided to store embeddings in FAISS and keep only faiss_index_path, faiss_index_id, and embedding_model in PostgreSQL.', 0, 1),
  ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', 'The RAG answer must include citations containing document_id, chunk_id, file_name, and page_number.', 1, 2),
  ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000301', 'The backend exposes project dashboard endpoints and document ingestion endpoints through FastAPI.', 0, 1),
  ('00000000-0000-0000-0000-000000000506', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000301', 'Todo and issue extraction results are stored in ai_summaries.extracted_json before user confirmation.', 1, 2);

INSERT INTO chunk_embeddings (id, chunk_id, faiss_index_path, faiss_index_id, embedding_model) VALUES
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000501', 'faiss/projects/00000000-0000-0000-0000-000000000301/index.faiss', 501, 'text-embedding-3-small'),
  ('00000000-0000-0000-0000-000000000512', '00000000-0000-0000-0000-000000000502', 'faiss/projects/00000000-0000-0000-0000-000000000301/index.faiss', 502, 'text-embedding-3-small'),
  ('00000000-0000-0000-0000-000000000513', '00000000-0000-0000-0000-000000000503', 'faiss/projects/00000000-0000-0000-0000-000000000301/index.faiss', 503, 'text-embedding-3-small'),
  ('00000000-0000-0000-0000-000000000514', '00000000-0000-0000-0000-000000000504', 'faiss/projects/00000000-0000-0000-0000-000000000301/index.faiss', 504, 'text-embedding-3-small'),
  ('00000000-0000-0000-0000-000000000515', '00000000-0000-0000-0000-000000000505', 'faiss/projects/00000000-0000-0000-0000-000000000301/index.faiss', 505, 'text-embedding-3-small'),
  ('00000000-0000-0000-0000-000000000516', '00000000-0000-0000-0000-000000000506', 'faiss/projects/00000000-0000-0000-0000-000000000301/index.faiss', 506, 'text-embedding-3-small');

INSERT INTO todos (
  id,
  project_id,
  assignee_id,
  created_by,
  source_document_id,
  source_chunk_id,
  title,
  description,
  status,
  priority,
  source_type,
  approval_status,
  confidence_score,
  reviewed_by,
  reviewed_at,
  due_date
) VALUES
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000501', 'Implement dashboard summary query', 'Return todo, issue, handoff, and recent document metrics by project.', 'completed', 'high', 'manual', 'approved', NULL, NULL, NULL, '2026-05-12'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000502', 'Add project_id filters to all core queries', 'Make sure documents, todos, issues, chat, reports, and summaries are project-scoped.', 'completed', 'high', 'manual', 'approved', NULL, NULL, NULL, '2026-05-12'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000503', 'Open PostgreSQL port 5432 on Azure VM', 'AI extracted this from meeting notes; assignee should approve before it becomes official.', 'pending', 'high', 'ai', 'pending', 87, NULL, NULL, '2026-05-15'),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000504', 'Request RAG chunking code review', 'AI extracted this from meeting notes; keep it separate until approved.', 'pending', 'medium', 'ai', 'pending', 82, NULL, NULL, '2026-05-16'),
  ('00000000-0000-0000-0000-000000000605', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000505', 'Draft FastAPI dashboard response schema', 'Define response objects for the dashboard cards and lists.', 'pending', 'medium', 'manual', 'approved', NULL, NULL, NULL, '2026-05-17'),
  ('00000000-0000-0000-0000-000000000606', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000506', 'Upload .env.example to GitHub', 'AI extracted this as a candidate Todo from uploaded API notes.', 'pending', 'low', 'ai', 'pending', 76, NULL, NULL, '2026-05-20'),
  ('00000000-0000-0000-0000-000000000607', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000501', 'Fix delayed handoff checklist', 'The first handoff checklist draft missed deployment and test coverage items.', 'in_progress', 'high', 'manual', 'approved', NULL, NULL, NULL, '2026-05-10'),
  ('00000000-0000-0000-0000-000000000608', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000504', 'Prepare weekly report draft', 'Summarize completed todos, open issues, and next week risks.', 'pending', 'high', 'manual', 'approved', NULL, NULL, NULL, '2026-05-13');

INSERT INTO issues (
  id,
  project_id,
  reporter_id,
  assignee_id,
  source_document_id,
  title,
  description,
  severity,
  status,
  source_type,
  confidence_score,
  is_candidate
) VALUES
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000402', 'Citation format not finalized', 'The assistant answer citation payload is not locked yet.', 'high', 'open', 'manual', NULL, false),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000401', 'Delayed handoff checklist review', 'Deployment and test coverage items must be added before handoff.', 'high', 'in_progress', 'manual', NULL, false),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000403', 'Dashboard response schema needs sign-off', 'Frontend and backend field names must be aligned.', 'medium', 'open', 'ai', 81, true);

INSERT INTO chat_messages (id, project_id, user_id, role, content, sources_json, created_at) VALUES
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', 'user', 'What is blocking handoff readiness?', '[]'::jsonb, '2026-05-13 10:30:00+09'),
  ('00000000-0000-0000-0000-000000000712', '00000000-0000-0000-0000-000000000301', NULL, 'assistant', 'The main blockers are citation format, handoff checklist gaps, and dashboard response schema sign-off.', '[{"document_id":"00000000-0000-0000-0000-000000000402","chunk_id":"00000000-0000-0000-0000-000000000504","file_name":"meeting-notes-2026-05-12.docx","page_number":2}]'::jsonb, '2026-05-13 10:30:04+09'),
  ('00000000-0000-0000-0000-000000000713', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', 'user', 'Which dashboard metrics are required?', '[]'::jsonb, '2026-05-13 11:00:00+09'),
  ('00000000-0000-0000-0000-000000000714', '00000000-0000-0000-0000-000000000301', NULL, 'assistant', 'Required metrics are progress rate, this week todos, completed todos, delayed todos, unresolved issues, urgent issues, handoff score, and recent uploads.', '[{"document_id":"00000000-0000-0000-0000-000000000401","chunk_id":"00000000-0000-0000-0000-000000000501","file_name":"requirements-summary.pdf","page_number":1}]'::jsonb, '2026-05-13 11:00:05+09'),
  ('00000000-0000-0000-0000-000000000715', '00000000-0000-0000-0000-000000000301', NULL, 'assistant', 'Document ingestion finished for 2 of 3 uploaded documents.', '[]'::jsonb, '2026-05-13 11:10:00+09');

INSERT INTO weekly_reports (
  id,
  project_id,
  created_by,
  week_start,
  week_end,
  content,
  progress_rate
) VALUES (
  '00000000-0000-0000-0000-000000000801',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000102',
  '2026-05-11',
  '2026-05-17',
  'This week completed dashboard SQL and project-centered schema design. Remaining work includes citation contract and handoff checklist validation.',
  68
);

INSERT INTO monthly_reports (
  id,
  project_id,
  created_by,
  month_start,
  month_end,
  content,
  progress_rate
) VALUES (
  '00000000-0000-0000-0000-000000000802',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000102',
  '2026-05-01',
  '2026-05-31',
  'May progress focused on project-centered schema, RAG citation strategy, Todo approval flow, and report generation.',
  42
);

INSERT INTO handoff_reports (
  id,
  project_id,
  created_by,
  title,
  content,
  handoff_score,
  missing_items_json
) VALUES (
  '00000000-0000-0000-0000-000000000901',
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000102',
  'TeamMemory MVP Handoff Readiness',
  'The project has a stable project-centered DB direction. Remaining gaps are citation format, deployment notes, and API response naming.',
  82,
  '[{"item":"citation format"},{"item":"deployment notes"},{"item":"API response naming"}]'::jsonb
);

INSERT INTO ai_summaries (id, project_id, document_id, summary_type, summary, extracted_json) VALUES
  (
    '00000000-0000-0000-0000-000000000A01',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000401',
    'weekly',
    'Dashboard requirements focus on project-scoped todos, issues, handoff score, and recent document uploads.',
    '{"todos":["Implement dashboard summary query"],"issues":["Dashboard response schema needs sign-off"],"decisions":["Use project_id as primary scope"]}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000A02',
    '00000000-0000-0000-0000-000000000301',
    NULL,
    'monthly',
    'Handoff readiness is good but still missing citation and deployment details.',
    '{"handoff_score":82,"missing_items":["citation format","deployment notes","API response naming"]}'::jsonb
  );
