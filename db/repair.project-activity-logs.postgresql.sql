-- Repair a partially applied v3 schema where project_activity_logs is missing.
-- Safe to run after projects and users have already been created.

CREATE TABLE IF NOT EXISTS public.project_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(500) NOT NULL,
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT project_activity_logs_type_check CHECK (
    activity_type IN ('document_uploaded', 'analysis_completed', 'todo_changed', 'issue_changed', 'event_created', 'report_saved', 'handoff_created', 'chat_answered')
  ),
  CONSTRAINT project_activity_logs_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_project_activity_logs_project_created
  ON public.project_activity_logs(project_id, created_at);

CREATE INDEX IF NOT EXISTS idx_project_activity_logs_type
  ON public.project_activity_logs(activity_type);

SELECT to_regclass('public.project_activity_logs') AS repaired_table;
