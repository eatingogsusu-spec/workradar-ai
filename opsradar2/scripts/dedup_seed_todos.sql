-- Collapse the triplicated seed todos down to one row per real piece of work.
--
-- insert_current_seed.sql emits every todo three times, suffixed " 확인 1/2/3". The
-- three rows carry the same title stem, the same description (character for character)
-- and the same linked_issue_id; only assignee and due_at differ (+2 days each). To a
-- user that reads as the same task listed three times, and it feeds the same triplicate
-- into report/handover grounding.
--
-- We keep " 확인 1" of each group and drop 2 and 3, then strip the now-meaningless
-- numbering from the surviving title. Keeping the first of each group happens to leave a
-- healthy status mix (completed / in_progress / pending), so no re-balancing is needed
-- afterwards -- do NOT re-run redistribute_seed_status.sql, whose row counts are tuned
-- for the 45-row shape.
--
-- Safety: nothing references todos.id. Verified against pg_constraint -- there is no
-- foreign key pointing at the todos table, and no other table carries a todo id column
-- (ai_summaries.todo_count is a count, not a reference). The script still asserts this
-- at run time and aborts if that ever changes.
--
-- Usage:  psql -U postgres -d azag_db -f scripts/dedup_seed_todos.sql
-- Re-running is safe: once the suffixes are stripped, nothing matches and it is a no-op.

BEGIN;

-- Abort rather than silently orphan rows if someone adds an FK to todos later.
DO $$
DECLARE
    referencing text;
BEGIN
    SELECT string_agg(conrelid::regclass::text, ', ')
      INTO referencing
      FROM pg_constraint
     WHERE contype = 'f'
       AND confrelid = 'opsradar2.todos'::regclass;

    IF referencing IS NOT NULL THEN
        RAISE EXCEPTION 'todos is now referenced by: % -- review cascade before deleting', referencing;
    END IF;
END $$;

\echo '--- before ---'
SELECT count(*) AS todos,
       count(DISTINCT regexp_replace(title, ' 확인 [0-9]+$', '')) AS distinct_work,
       count(linked_issue_id) AS with_issue_link
  FROM opsradar2.todos;

-- Drop every clone except the first of each group.
DELETE FROM opsradar2.todos
 WHERE title LIKE '[DUMMY]%'
   AND title ~ ' 확인 [0-9]+$'
   AND title !~ ' 확인 1$';

-- Drop the clone index but keep the trailing "확인". The number was meaningless, the
-- word is not: each todo's title stem is identical to its linked issue's title, so
-- stripping "확인" too would make the todo and the issue read as the same sentence
-- ("이슈 X → 그로 인해 생긴 X") and the handover model conflates the two.
UPDATE opsradar2.todos
   SET title = regexp_replace(title, ' 확인 [0-9]+$', ' 확인')
 WHERE title LIKE '[DUMMY]%'
   AND title ~ ' 확인 [0-9]+$';

-- Repair a database already flattened by the first version of this script, which
-- stripped "확인" along with the number.
UPDATE opsradar2.todos t
   SET title = t.title || ' 확인'
  FROM opsradar2.issues i
 WHERE t.title LIKE '[DUMMY]%'
   AND t.title = i.title;

COMMIT;

\echo '--- after ---'
SELECT count(*) AS todos,
       count(DISTINCT title) AS distinct_titles,
       count(linked_issue_id) AS with_issue_link,
       count(*) FILTER (WHERE title ~ ' 확인 [0-9]+$') AS still_numbered
  FROM opsradar2.todos;

\echo '--- status mix ---'
SELECT status, approval_status, count(*)
  FROM opsradar2.todos
 GROUP BY 1, 2
 ORDER BY 3 DESC;

\echo '--- surviving todos ---'
SELECT left(title, 52) AS title,
       status,
       left(linked_issue_id::text, 8) AS issue_link,
       due_at::date
  FROM opsradar2.todos
 ORDER BY status, title;
