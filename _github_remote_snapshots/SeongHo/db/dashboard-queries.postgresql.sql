-- TeamMemory dashboard queries.
-- Bind parameters from FastAPI/SQLAlchemy:
--   :project_id, :week_start, :week_end, :limit

-- 1. Project dashboard summary in one round trip.
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COUNT(t.id) FILTER (WHERE t.approval_status = 'approved') AS total_todo_count,
  COUNT(t.id) FILTER (WHERE t.approval_status = 'approved' AND t.status = 'completed') AS completed_todo_count,
  COUNT(t.id) FILTER (
    WHERE t.approval_status = 'approved'
      AND t.status <> 'completed'
      AND t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
  ) AS delayed_todo_count,
  COUNT(t.id) FILTER (
    WHERE t.approval_status = 'approved'
      AND t.due_date BETWEEN :week_start AND :week_end
  ) AS current_week_todo_count,
  COUNT(t.id) FILTER (
    WHERE t.source_type = 'ai'
      AND t.approval_status = 'pending'
  ) AS pending_ai_todo_count,
  (
    SELECT COUNT(*)
    FROM issues i
    WHERE i.project_id = p.id
      AND i.is_candidate = false
      AND i.status IN ('open', 'in_progress')
  ) AS unresolved_issue_count,
  (
    SELECT COUNT(*)
    FROM issues i
    WHERE i.project_id = p.id
      AND i.is_candidate = true
  ) AS candidate_issue_count,
  (
    SELECT hr.handoff_score
    FROM handoff_reports hr
    WHERE hr.project_id = p.id
    ORDER BY hr.created_at DESC
    LIMIT 1
  ) AS latest_handoff_score
FROM projects p
LEFT JOIN todos t ON t.project_id = p.id
WHERE p.id = :project_id
GROUP BY p.id, p.name;

-- 2. Project-level total Todo count.
SELECT
  project_id,
  COUNT(*) AS total_todo_count
FROM todos
WHERE project_id = :project_id
  AND approval_status = 'approved'
GROUP BY project_id;

-- 3. Completed Todo count.
SELECT
  project_id,
  COUNT(*) AS completed_todo_count
FROM todos
WHERE project_id = :project_id
  AND approval_status = 'approved'
  AND status = 'completed'
GROUP BY project_id;

-- 4. Delayed Todo count.
SELECT
  project_id,
  COUNT(*) AS delayed_todo_count
FROM todos
WHERE project_id = :project_id
  AND approval_status = 'approved'
  AND status <> 'completed'
  AND due_date IS NOT NULL
  AND due_date < CURRENT_DATE
GROUP BY project_id;

-- 5. Current week Todo count.
SELECT
  project_id,
  COUNT(*) AS current_week_todo_count
FROM todos
WHERE project_id = :project_id
  AND approval_status = 'approved'
  AND due_date BETWEEN :week_start AND :week_end
GROUP BY project_id;

-- 6. Unresolved issue count.
SELECT
  project_id,
  COUNT(*) AS unresolved_issue_count
FROM issues
WHERE project_id = :project_id
  AND is_candidate = false
  AND status IN ('open', 'in_progress')
GROUP BY project_id;

-- 7. Urgent issue list.
SELECT
  i.id,
  i.project_id,
  i.title,
  i.description,
  i.severity,
  i.status,
  i.confidence_score,
  i.is_candidate,
  i.created_at,
  reporter.name AS reporter_name,
  assignee.name AS assignee_name,
  d.file_name AS source_file_name
FROM issues i
LEFT JOIN users reporter ON reporter.id = i.reporter_id
LEFT JOIN users assignee ON assignee.id = i.assignee_id
LEFT JOIN documents d ON d.id = i.source_document_id
WHERE i.project_id = :project_id
  AND i.is_candidate = false
  AND i.status IN ('open', 'in_progress')
  AND i.severity = 'high'
ORDER BY
  CASE i.severity
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    ELSE 3
  END,
  i.created_at DESC
LIMIT :limit;

-- 8. Latest handoff score.
SELECT
  id,
  project_id,
  title,
  handoff_score,
  missing_items_json,
  created_at
FROM handoff_reports
WHERE project_id = :project_id
ORDER BY created_at DESC
LIMIT 1;

-- 9. Recent uploaded documents.
SELECT
  d.id,
  d.project_id,
  d.file_name,
  d.file_type,
  d.source_type,
  d.status,
  d.uploaded_at,
  uploader.name AS uploaded_by_name,
  COUNT(dc.id) AS chunk_count
FROM documents d
JOIN users uploader ON uploader.id = d.uploaded_by
LEFT JOIN document_chunks dc ON dc.document_id = d.id
WHERE d.project_id = :project_id
GROUP BY d.id, uploader.name
ORDER BY d.uploaded_at DESC, d.created_at DESC
LIMIT :limit;

-- 10. AI extracted Todo approval queue.
SELECT
  t.id,
  t.project_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_date,
  t.source_type,
  t.approval_status,
  t.confidence_score,
  assignee.name AS assignee_name,
  d.file_name AS source_file_name,
  dc.page_number AS source_page_number
FROM todos t
LEFT JOIN users assignee ON assignee.id = t.assignee_id
LEFT JOIN documents d ON d.id = t.source_document_id
LEFT JOIN document_chunks dc ON dc.id = t.source_chunk_id
WHERE t.project_id = :project_id
  AND t.source_type = 'ai'
  AND t.approval_status = 'pending'
ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
LIMIT :limit;

-- 11. Official Todo list for the Todo page.
SELECT
  t.id,
  t.project_id,
  t.title,
  t.description,
  t.status,
  t.priority,
  t.due_date,
  t.source_type,
  t.approval_status,
  t.confidence_score,
  assignee.name AS assignee_name,
  creator.name AS created_by_name
FROM todos t
LEFT JOIN users assignee ON assignee.id = t.assignee_id
JOIN users creator ON creator.id = t.created_by
WHERE t.project_id = :project_id
  AND t.approval_status = 'approved'
ORDER BY
  CASE t.status
    WHEN 'in_progress' THEN 2
    WHEN 'pending' THEN 3
    WHEN 'completed' THEN 4
    ELSE 5
  END,
  t.due_date ASC NULLS LAST,
  t.created_at DESC
LIMIT :limit;

-- 12. Approve or reject an AI-extracted Todo.
-- Bind :todo_id, :reviewer_id, :approval_status where approval_status is 'approved' or 'rejected'.
UPDATE todos
SET
  approval_status = :approval_status,
  reviewed_by = :reviewer_id,
  reviewed_at = now(),
  updated_at = now()
WHERE id = :todo_id
  AND source_type = 'ai'
  AND approval_status = 'pending'
RETURNING
  id,
  project_id,
  title,
  source_type,
  approval_status,
  reviewed_by,
  reviewed_at;

-- 13. Issue candidate list for review tab.
SELECT
  i.id,
  i.project_id,
  i.title,
  i.description,
  i.severity,
  i.status,
  i.confidence_score,
  i.is_candidate,
  i.created_at,
  reporter.name AS reporter_name,
  assignee.name AS assignee_name,
  d.file_name AS source_file_name
FROM issues i
JOIN users reporter ON reporter.id = i.reporter_id
LEFT JOIN users assignee ON assignee.id = i.assignee_id
LEFT JOIN documents d ON d.id = i.source_document_id
WHERE i.project_id = :project_id
  AND i.is_candidate = true
ORDER BY i.confidence_score DESC NULLS LAST, i.created_at DESC
LIMIT :limit;

-- 14. Promote or reject an issue candidate.
-- Bind :issue_id, :is_candidate where is_candidate is false to confirm, or delete separately to reject.
UPDATE issues
SET
  is_candidate = :is_candidate,
  updated_at = now()
WHERE id = :issue_id
  AND is_candidate = true
RETURNING
  id,
  project_id,
  title,
  confidence_score,
  is_candidate,
  updated_at;
