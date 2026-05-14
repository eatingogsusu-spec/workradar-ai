-- TeamMemory DB verification queries.
-- Run this after schema.postgresql.sql and seed.postgresql.sql.

-- 1. Expected seed counts.
SELECT 'users' AS table_name, COUNT(*) AS row_count, 5 AS expected_count FROM users
UNION ALL
SELECT 'teams', COUNT(*), 1 FROM teams
UNION ALL
SELECT 'projects', COUNT(*), 1 FROM projects
UNION ALL
SELECT 'project_members', COUNT(*), 5 FROM project_members
UNION ALL
SELECT 'documents', COUNT(*), 3 FROM documents
UNION ALL
SELECT 'document_chunks', COUNT(*), 6 FROM document_chunks
UNION ALL
SELECT 'chunk_embeddings', COUNT(*), 6 FROM chunk_embeddings
UNION ALL
SELECT 'todos', COUNT(*), 8 FROM todos
UNION ALL
SELECT 'issues', COUNT(*), 3 FROM issues
UNION ALL
SELECT 'chat_messages', COUNT(*), 5 FROM chat_messages
UNION ALL
SELECT 'weekly_reports', COUNT(*), 1 FROM weekly_reports
UNION ALL
SELECT 'handoff_reports', COUNT(*), 1 FROM handoff_reports
UNION ALL
SELECT 'ai_summaries', COUNT(*), 2 FROM ai_summaries;

-- 2. Project-centered required columns.
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'documents' AND column_name IN ('project_id', 'uploaded_by'))
    OR (table_name = 'todos' AND column_name IN ('project_id', 'assignee_id', 'created_by', 'source_type', 'approval_status', 'reviewed_by'))
    OR (table_name = 'issues' AND column_name IN ('project_id', 'reporter_id', 'assignee_id'))
    OR (table_name = 'chat_messages' AND column_name IN ('project_id', 'user_id', 'sources_json'))
    OR (table_name = 'handoff_reports' AND column_name IN ('handoff_score', 'missing_items_json'))
    OR (table_name = 'users' AND column_name IN ('email', 'password_hash'))
    OR (table_name = 'chunk_embeddings' AND column_name IN ('vector_store', 'vector_id', 'embedding_model'))
  )
ORDER BY table_name, column_name;

-- 3. Unique constraints that must exist.
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
  AND tc.table_name IN ('users', 'project_members')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- 4. Confirm no raw password column exists.
SELECT
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name ILIKE '%password%';

-- 5. Confirm chunk_embeddings does not store vector payloads.
SELECT
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'chunk_embeddings'
ORDER BY ordinal_position;

-- 5-1. Confirm FAISS is the seeded vector store reference.
SELECT
  vector_store,
  COUNT(*) AS row_count
FROM chunk_embeddings
GROUP BY vector_store
ORDER BY vector_store;

-- 5-2. Confirm AI Todo approval queue exists in the shared todos table.
SELECT
  source_type,
  approval_status,
  COUNT(*) AS row_count
FROM todos
GROUP BY source_type, approval_status
ORDER BY source_type, approval_status;

-- 6. Dashboard smoke test for seeded project.
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COUNT(t.id) FILTER (WHERE t.approval_status = 'approved') AS total_todo_count,
  COUNT(t.id) FILTER (WHERE t.approval_status = 'approved' AND t.status = 'done') AS completed_todo_count,
  COUNT(t.id) FILTER (
    WHERE t.approval_status = 'approved'
      AND t.status <> 'done'
      AND t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
  ) AS delayed_todo_count,
  COUNT(t.id) FILTER (
    WHERE t.source_type = 'ai'
      AND t.approval_status = 'pending'
  ) AS pending_ai_todo_count,
  (
    SELECT COUNT(*)
    FROM issues i
    WHERE i.project_id = p.id
      AND i.status IN ('open', 'in_progress')
  ) AS unresolved_issue_count,
  (
    SELECT hr.handoff_score
    FROM handoff_reports hr
    WHERE hr.project_id = p.id
    ORDER BY hr.created_at DESC
    LIMIT 1
  ) AS latest_handoff_score
FROM projects p
LEFT JOIN todos t ON t.project_id = p.id
WHERE p.id = '00000000-0000-0000-0000-000000000301'
GROUP BY p.id, p.name;
