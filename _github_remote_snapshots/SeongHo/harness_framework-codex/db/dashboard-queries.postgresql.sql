-- Dashboard and screen queries.
-- Replace :project_id, :week_start, :week_end, :user_id with parameters in the backend.

-- 1. Dashboard summary cards.
WITH latest_weekly_report AS (
  SELECT progress_rate
  FROM weekly_reports
  WHERE project_id = :project_id
  ORDER BY week_start DESC, created_at DESC
  LIMIT 1
),
todo_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE due_date BETWEEN :week_start AND :week_end) AS todo_total,
    COUNT(*) FILTER (
      WHERE due_date BETWEEN :week_start AND :week_end
        AND status = 'done'
    ) AS todo_done,
    COUNT(*) FILTER (
      WHERE due_date BETWEEN :week_start AND :week_end
        AND status = 'delayed'
    ) AS todo_delayed
  FROM todos
  WHERE project_id = :project_id
),
issue_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) AS issue_open,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS issue_in_progress
  FROM issues
  WHERE project_id = :project_id
),
latest_handoff_report AS (
  SELECT handoff_score, jsonb_array_length(missing_items_json) AS missing_item_count
  FROM handoff_reports
  WHERE project_id = :project_id
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  COALESCE((SELECT progress_rate FROM latest_weekly_report), 0) AS progress_rate,
  COALESCE((SELECT todo_total FROM todo_stats), 0) AS todo_total,
  COALESCE((SELECT todo_done FROM todo_stats), 0) AS todo_done,
  COALESCE((SELECT todo_delayed FROM todo_stats), 0) AS todo_delayed,
  COALESCE((SELECT issue_open FROM issue_stats), 0) AS issue_open,
  COALESCE((SELECT issue_in_progress FROM issue_stats), 0) AS issue_in_progress,
  COALESCE((SELECT handoff_score FROM latest_handoff_report), 0) AS handoff_score,
  COALESCE((SELECT missing_item_count FROM latest_handoff_report), 0) AS handoff_missing_count;

-- 2. Current week Todo list for dashboard.
SELECT
  t.id,
  t.title,
  t.status,
  t.priority,
  t.due_date,
  u.name AS assignee_name
FROM todos t
LEFT JOIN users u ON u.id = t.assignee_id
WHERE t.project_id = :project_id
  AND t.due_date BETWEEN :week_start AND :week_end
ORDER BY
  CASE t.status
    WHEN 'delayed' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'todo' THEN 3
    WHEN 'done' THEN 4
    ELSE 5
  END,
  CASE t.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  t.due_date ASC;

-- 3. Open issue list for dashboard and issue screen.
SELECT
  i.id,
  i.title,
  i.description,
  i.severity,
  i.status,
  reporter.name AS reporter_name,
  assignee.name AS assignee_name,
  i.created_at
FROM issues i
JOIN users reporter ON reporter.id = i.reporter_id
LEFT JOIN users assignee ON assignee.id = i.assignee_id
WHERE i.project_id = :project_id
  AND i.status IN ('open', 'in_progress')
ORDER BY
  CASE i.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  i.created_at DESC;

-- 4. Project document list for upload screen.
SELECT
  d.id,
  d.file_name,
  d.file_type,
  d.source_type,
  d.status,
  d.uploaded_at,
  u.name AS uploaded_by_name,
  COUNT(dc.id) AS chunk_count
FROM documents d
JOIN users u ON u.id = d.uploaded_by
LEFT JOIN document_chunks dc ON dc.document_id = d.id
WHERE d.project_id = :project_id
GROUP BY d.id, u.name
ORDER BY d.uploaded_at DESC;

-- 5. Project members for top bar/settings.
SELECT
  pm.id,
  pm.role AS project_role,
  pm.joined_at,
  u.id AS user_id,
  u.name,
  u.email
FROM project_members pm
JOIN users u ON u.id = pm.user_id
WHERE pm.project_id = :project_id
ORDER BY
  CASE pm.role
    WHEN 'owner' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'member' THEN 3
    ELSE 4
  END,
  u.name ASC;

-- 6. Chat history with source metadata.
SELECT
  cm.id,
  cm.role,
  cm.content,
  cm.sources_json,
  cm.created_at,
  u.name AS user_name
FROM chat_messages cm
LEFT JOIN users u ON u.id = cm.user_id
WHERE cm.project_id = :project_id
ORDER BY cm.created_at ASC;

-- 7. Latest handoff report.
SELECT
  id,
  title,
  content,
  handoff_score,
  missing_items_json,
  jsonb_array_length(missing_items_json) AS missing_item_count,
  created_at
FROM handoff_reports
WHERE project_id = :project_id
ORDER BY created_at DESC
LIMIT 1;

-- 8. Projects visible to a user.
SELECT
  p.id,
  p.name,
  p.description,
  p.status,
  p.start_date,
  p.end_date,
  t.name AS team_name,
  pm.role AS project_role
FROM project_members pm
JOIN projects p ON p.id = pm.project_id
JOIN teams t ON t.id = p.team_id
WHERE pm.user_id = :user_id
ORDER BY p.updated_at DESC;
