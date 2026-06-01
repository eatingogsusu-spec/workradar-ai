-- Minimal shared development context for an empty OpsRadar schema.
-- Run after schema.sql with search_path set to opsradar2, public.

INSERT INTO teams (id, name)
VALUES ('10000000-0000-0000-0000-000000000001', 'TeamAZAG')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, team_id, name, email, role)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'OpsRadar Admin',
    'opsradar-admin@teamazag.local',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (id, team_id, name, description)
VALUES (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'OpsRadar',
    'TeamAZAG shared development project'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (id, team_id, project_id, user_id, role)
VALUES (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'admin'
)
ON CONFLICT (project_id, user_id) DO NOTHING;
