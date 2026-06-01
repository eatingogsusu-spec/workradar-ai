-- TeamAZAG v3 schema verification queries.

-- 1. Expected v3 tables.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'users',
    'teams',
    'projects',
    'project_members',
    'documents',
    'document_chunks',
    'chunk_embeddings',
    'analysis_jobs',
    'analysis_steps',
    'ai_extractions',
    'todos',
    'issues',
    'issue_status_history',
    'project_events',
    'risk_windows',
    'project_reports',
    'handoff_reports',
    'handoff_items',
    'chat_sessions',
    'chat_messages',
    'chat_message_sources',
    'project_activity_logs'
  )
ORDER BY table_name;

-- 2. Confirm v3-only tables exist.
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'analysis_jobs',
    'analysis_steps',
    'ai_extractions',
    'issue_status_history',
    'project_events',
    'risk_windows',
    'project_reports',
    'handoff_items',
    'chat_sessions',
    'chat_message_sources'
  )
GROUP BY table_name
ORDER BY table_name;

-- 3. Confirm TODO supports blocked and AI approval.
SELECT
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name IN ('todos_status_check', 'todos_approval_status_check');

-- 4. Confirm issue history is linked to issues.
SELECT
  tc.table_name,
  tc.constraint_name,
  ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'issue_status_history'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 5. Confirm FAISS metadata table does not store vector payload.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chunk_embeddings'
ORDER BY ordinal_position;

-- 6. Confirm report version uniqueness exists.
SELECT
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name = 'project_reports'
GROUP BY tc.table_name, tc.constraint_name;

