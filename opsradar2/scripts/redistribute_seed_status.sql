-- Redistribute seeded [DUMMY] todo/issue statuses around a reference date.
--
-- The seed (dummy_data/06_current_db_seed/sql/insert_current_seed.sql) only ever
-- emits status pending|completed with approval_status='approved', so "in_progress"
-- is structurally 0 and the review queue is empty. This rebalances the seed rows
-- using due_at as the signal: long-overdue work reads as done, work that just
-- slipped or is due soon reads as in flight, far-future work is still queued.
--
-- Only rows whose title starts with '[DUMMY]' are touched, so anything the AI
-- extraction pipeline creates later (source_type='ai') is left alone.
--
-- Usage:
--   psql -U postgres -d azag_db -f scripts/redistribute_seed_status.sql
--   psql -U postgres -d azag_db -v ref_date=2026-07-12 -f scripts/redistribute_seed_status.sql
--
-- Re-running is safe: buckets derive from due_at, not from current status.

\if :{?ref_date}
\else
  \set ref_date '2026-07-12'
\endif

\echo 'reference date:' :ref_date

BEGIN;

-- ── todos ────────────────────────────────────────────────────────────────────
-- bucket 1  due_at < ref-60d   (24 rows) → 15 completed  + 9 in_progress (지연 건)
-- bucket 2  ref-60d..ref       ( 4 rows) → in_progress            (마감 막 지남)
-- bucket 3  ref..ref+45d       ( 5 rows) → in_progress            (마감 임박, 작업 중)
-- bucket 4  > ref+45d          (12 rows) → pending                (아직 착수 전)
-- target: completed 15 / in_progress 18 / pending 12
WITH bucketed AS (
    SELECT
        id,
        due_at,
        CASE
            WHEN due_at::date <  DATE :'ref_date' - 60 THEN 1
            WHEN due_at::date <  DATE :'ref_date'      THEN 2
            WHEN due_at::date <= DATE :'ref_date' + 45 THEN 3
            ELSE 4
        END AS bucket
    FROM opsradar2.todos
    WHERE title LIKE '[DUMMY]%'
),
ranked AS (
    SELECT
        id,
        bucket,
        ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY due_at, id) AS rn
    FROM bucketed
),
assigned AS (
    SELECT
        id,
        CASE
            -- oldest 15 of the long-overdue bucket: finished and closed out
            WHEN bucket = 1 AND rn <= 15 THEN 'completed'
            -- the rest of the overdue bucket: slipped, still being worked
            WHEN bucket = 1              THEN 'in_progress'
            WHEN bucket IN (2, 3)        THEN 'in_progress'
            ELSE                              'pending'
        END AS new_status,
        CASE
            -- far-future work: nearest 4 already approved, rest still awaiting review
            WHEN bucket = 4 AND rn <= 4 THEN 'approved'
            WHEN bucket = 4             THEN 'pending'
            ELSE                             'approved'
        END AS new_approval
    FROM ranked
)
UPDATE opsradar2.todos t
SET status          = a.new_status,
    approval_status = a.new_approval,
    updated_at      = now()
FROM assigned a
WHERE t.id = a.id;

-- ── issues ───────────────────────────────────────────────────────────────────
-- bucket 1  due_at < ref-60d  (8 rows) → 4 resolved + 4 in_progress
-- bucket 2  ref-60d..ref      (1 row)  → in_progress
-- bucket 3  >= ref            (6 rows) → 3 in_progress + 3 open
-- target: in_progress 8 / resolved 4 / open 3
WITH bucketed AS (
    SELECT
        id,
        due_at,
        CASE
            WHEN due_at::date < DATE :'ref_date' - 60 THEN 1
            WHEN due_at::date < DATE :'ref_date'      THEN 2
            ELSE 3
        END AS bucket
    FROM opsradar2.issues
    WHERE title LIKE '[DUMMY]%'
),
ranked AS (
    SELECT
        id,
        bucket,
        ROW_NUMBER() OVER (PARTITION BY bucket ORDER BY due_at, id) AS rn
    FROM bucketed
),
assigned AS (
    SELECT
        id,
        CASE
            WHEN bucket = 1 AND rn <= 4 THEN 'resolved'
            WHEN bucket = 1             THEN 'in_progress'
            WHEN bucket = 2             THEN 'in_progress'
            WHEN bucket = 3 AND rn <= 3 THEN 'in_progress'
            ELSE                             'open'
        END AS new_status
    FROM ranked
)
UPDATE opsradar2.issues i
SET status          = a.new_status,
    -- unreviewed open issues sit in the approval queue; everything else is approved
    approval_status = CASE WHEN a.new_status = 'open' THEN 'pending' ELSE 'approved' END,
    updated_at      = now()
FROM assigned a
WHERE i.id = a.id;

COMMIT;

\echo '--- todos after ---'
SELECT status, approval_status, count(*) FROM opsradar2.todos GROUP BY 1, 2 ORDER BY 3 DESC;
\echo '--- issues after ---'
SELECT status, approval_status, count(*) FROM opsradar2.issues GROUP BY 1, 2 ORDER BY 3 DESC;
