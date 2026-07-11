-- Examples only. Confirm the current schema before execution.
-- Documents without a project
SELECT id FROM documents WHERE project_id IS NULL;
-- Document chunks without a document
SELECT dc.id FROM document_chunks dc LEFT JOIN documents d ON d.id = dc.document_id WHERE d.id IS NULL;
-- Todos linked to a missing issue
SELECT t.id FROM todos t LEFT JOIN issues i ON i.id = t.linked_issue_id WHERE t.linked_issue_id IS NOT NULL AND i.id IS NULL;
-- Issue status distribution
SELECT status, COUNT(*) FROM issues GROUP BY status ORDER BY status;
-- Todos with no assignee
SELECT id, title FROM todos WHERE assignee_member_id IS NULL;
-- Weekly report period errors
SELECT id FROM weekly_reports WHERE week_start > week_end;
-- Handoff reports missing owners
SELECT id FROM handoff_reports WHERE from_member_id IS NULL OR to_member_id IS NULL;
