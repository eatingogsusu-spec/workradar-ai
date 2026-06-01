-- Smoke checks for OpsRadar schema v4.

SELECT
  COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'teams',
    'users',
    'projects',
    'project_members',
    'documents',
    'document_chunks',
    'faiss_indexes',
    'chunk_embeddings',
    'embedding_jobs',
    'todos',
    'issues',
    'issue_history',
    'calendar_events',
    'weekly_reports',
    'monthly_reports',
    'handoff_reports',
    'chat_messages',
    'ai_summaries'
  );

SELECT
  tc.table_name,
  COUNT(*) AS foreign_key_count
FROM information_schema.table_constraints tc
WHERE tc.constraint_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'project_members',
    'documents',
    'document_chunks',
    'faiss_indexes',
    'chunk_embeddings',
    'embedding_jobs',
    'todos',
    'issues',
    'issue_history',
    'calendar_events',
    'weekly_reports',
    'monthly_reports',
    'handoff_reports',
    'chat_messages',
    'ai_summaries'
  )
GROUP BY tc.table_name
ORDER BY tc.table_name;

SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_%'
    OR indexname LIKE 'uq_%'
  )
ORDER BY tablename, indexname;
