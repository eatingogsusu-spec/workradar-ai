-- Dashboard query examples aligned with the latest OpsRadar ERD.
-- Bind parameters:
--   :project_id, :limit, :from_at, :to_at

-- 1. Project-level Todo status counts.
SELECT
  status,
  COUNT(*) AS todo_count
FROM todos
WHERE project_id = :project_id
GROUP BY status
ORDER BY status;

-- 2. Project-level Issue status counts.
SELECT
  status,
  COUNT(*) AS issue_count
FROM issues
WHERE project_id = :project_id
  AND approval_status IN ('approved', 'confirmed')
GROUP BY status
ORDER BY status;

-- 3. High risk issue count.
SELECT
  COUNT(*) AS high_risk_issue_count
FROM issues
WHERE project_id = :project_id
  AND severity IN ('high', 'critical')
  AND status IN ('open', 'in_progress', 'blocked')
  AND approval_status IN ('approved', 'confirmed');

-- 4. Pending AI Todo approval queue.
SELECT
  t.id,
  t.title,
  t.priority,
  t.status,
  t.confidence_score,
  t.due_at,
  pm.role AS assignee_role,
  u.name AS assignee_name
FROM todos t
LEFT JOIN project_members pm ON pm.id = t.assignee_member_id
LEFT JOIN users u ON u.id = pm.user_id
WHERE t.project_id = :project_id
  AND t.source_type = 'ai'
  AND t.approval_status = 'pending'
ORDER BY t.confidence_score DESC NULLS LAST, t.created_at DESC
LIMIT :limit;

-- 5. Recent operational issues.
SELECT
  i.id,
  i.title,
  i.severity,
  i.status,
  i.source_type,
  i.approval_status,
  i.confidence_score,
  i.created_at,
  u.name AS assignee_name
FROM issues i
LEFT JOIN project_members pm ON pm.id = i.assignee_member_id
LEFT JOIN users u ON u.id = pm.user_id
WHERE i.project_id = :project_id
  AND i.approval_status IN ('approved', 'confirmed')
ORDER BY
  CASE i.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  i.created_at DESC
LIMIT :limit;

-- 6. Recent uploaded documents.
SELECT
  d.id,
  d.file_name,
  d.file_type,
  d.status,
  d.created_at,
  u.name AS uploaded_by_name,
  COUNT(dc.id) AS chunk_count
FROM documents d
LEFT JOIN project_members pm ON pm.id = d.uploaded_by_member_id
LEFT JOIN users u ON u.id = pm.user_id
LEFT JOIN document_chunks dc ON dc.document_id = d.id
WHERE d.project_id = :project_id
  AND d.deleted_at IS NULL
GROUP BY d.id, u.name
ORDER BY d.created_at DESC
LIMIT :limit;

-- 7. Calendar events in a period.
SELECT
  ce.id,
  ce.title,
  ce.event_type,
  ce.source_type,
  ce.approval_status,
  ce.starts_at,
  ce.ends_at,
  u.name AS member_name
FROM calendar_events ce
LEFT JOIN project_members pm ON pm.id = ce.member_id
LEFT JOIN users u ON u.id = pm.user_id
WHERE ce.project_id = :project_id
  AND ce.starts_at >= :from_at
  AND ce.starts_at < :to_at
ORDER BY ce.starts_at ASC;

-- 8. Weekly reports.
SELECT
  id,
  week_start,
  week_end,
  progress_rate,
  created_at
FROM weekly_reports
WHERE project_id = :project_id
ORDER BY week_start DESC
LIMIT :limit;

-- 9. Monthly reports.
SELECT
  id,
  month_start,
  month_end,
  progress_rate,
  created_at
FROM monthly_reports
WHERE project_id = :project_id
ORDER BY month_start DESC
LIMIT :limit;

-- 10. Latest handoff report.
SELECT
  id,
  project_id,
  from_member_id,
  to_member_id,
  handoff_type,
  content,
  created_at
FROM handoff_reports
WHERE project_id = :project_id
ORDER BY created_at DESC
LIMIT 1;

-- 11. Chat messages.
SELECT
  cm.id,
  cm.project_id,
  cm.member_id,
  cm.role,
  cm.content,
  cm.created_at,
  u.name AS member_name
FROM chat_messages cm
LEFT JOIN project_members pm ON pm.id = cm.member_id
LEFT JOIN users u ON u.id = pm.user_id
WHERE cm.project_id = :project_id
ORDER BY cm.created_at ASC
LIMIT :limit;