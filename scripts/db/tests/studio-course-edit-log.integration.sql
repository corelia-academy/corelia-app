-- Transactional edit-log coverage. Test data is removed before this script exits.

\set ON_ERROR_STOP on

SELECT pg_catalog.set_config('request.jwt.claim.sub', '', false);
SELECT pg_catalog.set_config('request.jwt.claims', '{}', false);
SELECT pg_catalog.set_config('app.studio_course_edit_log_source', '', false);
SELECT pg_catalog.set_config('app.studio_course_edit_log_actor', '', false);
SELECT pg_catalog.set_config('app.studio_course_edit_log_ref', '', false);

BEGIN;

CREATE TEMP TABLE _studio_edit_actors (
  kind text PRIMARY KEY,
  id uuid NOT NULL UNIQUE
);

INSERT INTO _studio_edit_actors(kind, id) VALUES
  ('admin', pg_catalog.gen_random_uuid()),
  ('instructor', pg_catalog.gen_random_uuid()),
  ('support', pg_catalog.gen_random_uuid()),
  ('co_instructor', pg_catalog.gen_random_uuid());

GRANT SELECT ON TABLE pg_temp._studio_edit_actors TO authenticated, service_role;

INSERT INTO auth.users (
  id, email, instance_id, aud, role, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  a.id,
  'edit-log-' || a.id::text || '@corelia.local',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  pg_catalog.now(),
  '',
  '',
  '',
  ''
FROM pg_temp._studio_edit_actors a;

UPDATE public.profiles p
SET
  role = CASE a.kind
    WHEN 'admin' THEN 'admin'
    WHEN 'support' THEN 'support_staff'
    ELSE 'instructor'
  END,
  instructor_origin = CASE WHEN a.kind IN ('instructor', 'co_instructor') THEN 'corelia' ELSE NULL END,
  full_name = CASE a.kind
    WHEN 'admin' THEN 'Edit Log Admin'
    WHEN 'instructor' THEN 'Edit Log Instructor'
    WHEN 'support' THEN 'Edit Log Support'
    ELSE 'Edit Log Co-instructor'
  END
FROM pg_temp._studio_edit_actors a
WHERE p.id = a.id;

CREATE TEMP TABLE _studio_edit_courses (
  kind text PRIMARY KEY,
  id text NOT NULL UNIQUE
);

INSERT INTO _studio_edit_courses(kind, id) VALUES
  ('main', 'edit-log-' || replace(pg_catalog.gen_random_uuid()::text, '-', '')),
  ('non_ai', 'edit-log-' || replace(pg_catalog.gen_random_uuid()::text, '-', '')),
  ('published_toggle', 'edit-log-' || replace(pg_catalog.gen_random_uuid()::text, '-', '')),
  ('published_guard', 'edit-log-' || replace(pg_catalog.gen_random_uuid()::text, '-', '')),
  ('cascade', 'edit-log-' || replace(pg_catalog.gen_random_uuid()::text, '-', ''));

GRANT SELECT ON TABLE pg_temp._studio_edit_courses TO authenticated, service_role;

INSERT INTO public.courses(id, instructor_id, published, slug, data)
SELECT
  c.id,
  instructor.id,
  false,
  c.id,
  pg_catalog.jsonb_build_object(
    'course_type', CASE WHEN c.kind = 'non_ai' THEN 'regular' ELSE 'ai_generated' END,
    'title', 'Initial course'
  ) || CASE
    WHEN c.kind = 'main' THEN pg_catalog.jsonb_build_object(
      'co_instructor_permissions',
      pg_catalog.jsonb_build_object(
        co_instructor.id::text,
        pg_catalog.jsonb_build_object('content', true)
      )
    )
    ELSE '{}'::jsonb
  END
FROM pg_temp._studio_edit_courses c
CROSS JOIN pg_temp._studio_edit_actors instructor
CROSS JOIN pg_temp._studio_edit_actors co_instructor
WHERE instructor.kind = 'instructor'
  AND co_instructor.kind = 'co_instructor';

INSERT INTO public.course_sections(course_id, id, sort_order, data)
SELECT c.id, 'section', 0, '{"title":"Initial section"}'::jsonb
FROM pg_temp._studio_edit_courses c;

INSERT INTO public.course_lessons(course_id, id, section_id, sort_order, published, data)
SELECT c.id, 'lesson-article', 'section', 0, false,
  '{"title":"Before title","lesson_format":"article","description_markdown":"Original lesson content"}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind IN ('main', 'non_ai', 'published_toggle', 'published_guard', 'cascade');

INSERT INTO public.course_lessons(course_id, id, section_id, sort_order, published, data)
SELECT c.id, 'lesson-quiz', 'section', 1, false,
  '{"title":"Quiz lesson","lesson_format":"quiz","quiz_config":{"allow_retry":true}}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind = 'main';

INSERT INTO public.course_lessons(course_id, id, section_id, sort_order, published, data)
SELECT c.id, 'lesson-delete', 'section', 2, false,
  '{"title":"Draft to delete","lesson_format":"article","description_markdown":"Draft content"}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind = 'main';

INSERT INTO public.course_section_questions(
  id, course_id, section_id, lesson_id, sort_order, data
)
SELECT
  'question-main',
  c.id,
  NULL,
  'lesson-quiz',
  0,
  '{"type":"mcq","question":"Choose an option","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"correct_index":0}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind = 'main';

INSERT INTO public.course_locales(course_id, locale, data)
SELECT c.id, 'en', '{"title":"Course translation"}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind = 'main';

INSERT INTO public.course_section_locales(course_id, section_id, locale, data)
SELECT c.id, 'section', 'en', '{"title":"Section translation"}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind = 'main';

INSERT INTO public.course_lesson_locales(course_id, lesson_id, locale, data)
SELECT c.id, 'lesson-article', 'en', '{"title":"Lesson translation"}'::jsonb
FROM pg_temp._studio_edit_courses c
WHERE c.kind = 'main';

UPDATE public.course_lessons l
SET published = true
FROM pg_temp._studio_edit_courses c
WHERE c.id = l.course_id
  AND c.kind IN ('published_toggle', 'published_guard')
  AND l.id = 'lesson-article';

UPDATE public.courses c
SET published = true
FROM pg_temp._studio_edit_courses f
WHERE f.id = c.id
  AND f.kind IN ('published_toggle', 'published_guard');

COMMIT;

SELECT id::text AS admin_id FROM pg_temp._studio_edit_actors WHERE kind = 'admin' \gset
SELECT id::text AS instructor_id FROM pg_temp._studio_edit_actors WHERE kind = 'instructor' \gset
SELECT id::text AS support_id FROM pg_temp._studio_edit_actors WHERE kind = 'support' \gset
SELECT id::text AS co_instructor_id FROM pg_temp._studio_edit_actors WHERE kind = 'co_instructor' \gset
SELECT id AS main_course_id FROM pg_temp._studio_edit_courses WHERE kind = 'main' \gset
SELECT id AS non_ai_course_id FROM pg_temp._studio_edit_courses WHERE kind = 'non_ai' \gset
SELECT id AS toggle_course_id FROM pg_temp._studio_edit_courses WHERE kind = 'published_toggle' \gset
SELECT id AS guard_course_id FROM pg_temp._studio_edit_courses WHERE kind = 'published_guard' \gset
SELECT id AS cascade_course_id FROM pg_temp._studio_edit_courses WHERE kind = 'cascade' \gset

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.studio_course_edits e
    JOIN pg_temp._studio_edit_courses c ON c.id = e.course_id
  ) THEN
    RAISE EXCEPTION 'Unattributed setup writes must not create edit records';
  END IF;
END;
$$;

-- One authenticated Save touches all seven content tables and produces one row.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;

UPDATE public.courses
SET data = data || '{"title":"Course after edit"}'::jsonb
WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');

UPDATE public.course_sections
SET data = data || '{"title":"Section after edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'section';

UPDATE public.course_lessons
SET data = data || '{"title":"Renamed lesson"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';

UPDATE public.course_section_questions
SET data = data || '{"question":"Question after edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'question-main';

UPDATE public.course_locales
SET data = data || '{"title":"Course translation after edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND locale = 'en';

UPDATE public.course_section_locales
SET data = data || '{"title":"Section translation after edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND section_id = 'section' AND locale = 'en';

UPDATE public.course_lesson_locales
SET data = data || '{"title":"Lesson translation after edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND lesson_id = 'lesson-article' AND locale = 'en';

RESET ROLE;

DO $$
DECLARE
  logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current()
    AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authenticated Save did not create its edit record';
  END IF;
  IF logged.source <> 'app_manual'
     OR logged.actor_id IS DISTINCT FROM (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin')::uuid
     OR logged.actor_name IS DISTINCT FROM (SELECT full_name FROM public.profiles WHERE id = (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin')::uuid)
     OR logged.source_ref IS NOT NULL THEN
    RAISE EXCEPTION 'Authenticated Save attribution is incorrect';
  END IF;
  IF pg_catalog.jsonb_array_length(logged.changes) <> 7 THEN
    RAISE EXCEPTION 'One Save across seven tables must have seven change items';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(logged.changes) c
    WHERE c->>'entity' = 'lesson'
      AND c->>'label' = 'Renamed lesson'
      AND c->'fields'->'title'->>'old' = 'Before title'
      AND c->'fields'->'title'->>'new' = 'Renamed lesson'
  ) THEN
    RAISE EXCEPTION 'Lesson rename diff or snapshot label is incorrect';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(logged.changes) c
    WHERE c->'fields' ? 'data'
  ) THEN
    RAISE EXCEPTION 'The audit record must store data keys, not whole rows';
  END IF;
END;
$$;
COMMIT;

-- Insert and update ordering changes retain operation and field-level values.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;

INSERT INTO public.course_sections(course_id, id, sort_order, data)
VALUES ((SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main'), 'section-inserted', 1, '{"title":"Inserted section"}'::jsonb);

RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current()
    AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND OR pg_catalog.jsonb_array_length(logged.changes) <> 1 THEN
    RAISE EXCEPTION 'Insert was not recorded once';
  END IF;
  IF logged.changes->0->>'op' <> 'insert'
     OR logged.changes->0->>'label' <> 'Inserted section'
     OR logged.changes->0->'fields'->'title'->>'new' <> 'Inserted section'
     OR (logged.changes->0->'fields'->'title') ? 'old' THEN
    RAISE EXCEPTION 'Insert diff shape is incorrect';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;

UPDATE public.course_lessons
SET sort_order = CASE id WHEN 'lesson-article' THEN 1 ELSE 0 END
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id IN ('lesson-article', 'lesson-quiz');

UPDATE public.course_section_questions
SET sort_order = 1
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'question-main';

RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current()
    AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND OR pg_catalog.jsonb_array_length(logged.changes) <> 3 THEN
    RAISE EXCEPTION 'Multi-item reorder was not recorded as three item changes';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(logged.changes) c
    WHERE (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(c->'fields')) <> 1
       OR NOT (c->'fields' ? 'sort_order')
       OR (SELECT pg_catalog.count(*) FROM pg_catalog.jsonb_object_keys(c->'fields'->'sort_order')) <> 2
       OR c->>'op' <> 'update'
  ) THEN
    RAISE EXCEPTION 'Reorder items must contain only sort_order changes';
  END IF;
END;
$$;
COMMIT;

-- Separate transactions produce separate rows and retain each non-admin actor.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'instructor'), true);
SET LOCAL ROLE authenticated;

UPDATE public.course_lessons
SET data = data || '{"description_markdown":"Instructor revision"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';

RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current()
    AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND
     OR logged.source <> 'app_manual'
     OR logged.actor_id IS DISTINCT FROM (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'instructor')::uuid
     OR logged.actor_name IS DISTINCT FROM (SELECT full_name FROM public.profiles WHERE id = (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'instructor')::uuid)
     OR logged.changes->0->>'label' <> 'Renamed lesson' THEN
    RAISE EXCEPTION 'Instructor attribution or current lesson label is incorrect';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'support'), true);
SET LOCAL ROLE authenticated;

UPDATE public.course_lessons
SET data = data || '{"description_markdown":"Support revision"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';

RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current()
    AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND
     OR logged.actor_id IS DISTINCT FROM (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'support')::uuid
     OR logged.actor_name IS DISTINCT FROM (SELECT full_name FROM public.profiles WHERE id = (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'support')::uuid) THEN
    RAISE EXCEPTION 'Support actor attribution is incorrect';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'co_instructor'), true);
SET LOCAL ROLE authenticated;

UPDATE public.course_lessons
SET data = data || '{"description_markdown":"Co-instructor revision"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';

RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current()
    AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND
     OR logged.actor_id IS DISTINCT FROM (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'co_instructor')::uuid
     OR logged.actor_name IS DISTINCT FROM (SELECT full_name FROM public.profiles WHERE id = (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'co_instructor')::uuid) THEN
    RAISE EXCEPTION 'Co-instructor attribution is incorrect';
  END IF;
  IF (
    SELECT pg_catalog.count(DISTINCT e.txid)
    FROM public.studio_course_edits e
    WHERE e.course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(e.changes) c
        WHERE c->'fields' ? 'description_markdown'
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'Three committed edits must have distinct transaction records';
  END IF;
END;
$$;
COMMIT;

-- A non-AI course stays outside this audit table.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;
UPDATE public.course_lessons
SET data = data || '{"description_markdown":"Non-AI edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'non_ai') AND id = 'lesson-article';
RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.studio_course_edits
    WHERE txid = pg_catalog.txid_current()
      AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'non_ai')
  ) THEN
    RAISE EXCEPTION 'Non-AI course created an edit record';
  END IF;
END;
$$;
COMMIT;

-- Timestamp-only and derived-duration-only writes do not create records.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
UPDATE public.courses
SET updated_at = updated_at + interval '1 second'
WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.studio_course_edits WHERE txid = pg_catalog.txid_current()) THEN
    RAISE EXCEPTION 'updated_at-only write created an edit record';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
UPDATE public.courses
SET data = pg_catalog.jsonb_set(data, '{total_duration_seconds}', '999'::jsonb, true)
WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.studio_course_edits WHERE txid = pg_catalog.txid_current()) THEN
    RAISE EXCEPTION 'total_duration_seconds-only write created an edit record';
  END IF;
END;
$$;
COMMIT;

-- Only published and archived columns change in these transactions.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;
UPDATE public.courses SET published = false WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_toggle');
RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_toggle');
  IF NOT FOUND
     OR pg_catalog.jsonb_array_length(logged.changes) <> 1
     OR logged.changes->0->'fields' <> '{"published":{"old":true,"new":false}}'::jsonb THEN
    RAISE EXCEPTION 'published-only edit was not captured exactly';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;
UPDATE public.courses SET archived_at = pg_catalog.now() WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_toggle');
RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_toggle');
  IF NOT FOUND
     OR pg_catalog.jsonb_array_length(logged.changes) <> 1
     OR NOT (logged.changes->0->'fields' ? 'archived_at')
     OR pg_catalog.jsonb_object_length(logged.changes->0->'fields') <> 1 THEN
    RAISE EXCEPTION 'archived_at-only edit was not captured exactly';
  END IF;
END;
$$;
COMMIT;

-- Either OLD or NEW AI course_type is sufficient for a course-row edit.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
UPDATE public.courses
SET data = pg_catalog.jsonb_set(data, '{course_type}', '"regular"'::jsonb, true)
WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.studio_course_edits e,
         pg_catalog.jsonb_array_elements(e.changes) c
    WHERE e.txid = pg_catalog.txid_current()
      AND e.course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
      AND c->'fields'->'course_type'->>'old' = 'ai_generated'
      AND c->'fields'->'course_type'->>'new' = 'regular'
  ) THEN
    RAISE EXCEPTION 'AI-to-regular course_type transition was not captured';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
UPDATE public.courses
SET data = pg_catalog.jsonb_set(data, '{course_type}', '"ai_generated"'::jsonb, true)
WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.studio_course_edits e,
         pg_catalog.jsonb_array_elements(e.changes) c
    WHERE e.txid = pg_catalog.txid_current()
      AND e.course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
      AND c->'fields'->'course_type'->>'old' = 'regular'
      AND c->'fields'->'course_type'->>'new' = 'ai_generated'
  ) THEN
    RAISE EXCEPTION 'Regular-to-AI course_type transition was not captured';
  END IF;
END;
$$;
COMMIT;

-- Explicit adapter context preserves its source and source_ref in the same transaction.
BEGIN;
SELECT private.edit_log_context('studio_ai', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin')::uuid, '{"run":"context"}'::jsonb);
UPDATE public.course_sections
SET data = data || '{"description":"AI revision"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'section';

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND
     OR logged.source <> 'studio_ai'
     OR logged.actor_id IS DISTINCT FROM (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin')::uuid
     OR logged.source_ref IS DISTINCT FROM '{"run":"context"}'::jsonb THEN
    RAISE EXCEPTION 'Declared studio_ai context was not captured';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT private.edit_log_context('studio_manual', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'co_instructor')::uuid, NULL);
UPDATE public.course_sections
SET data = data || '{"description":"Manual Studio revision"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'section';

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND
     OR logged.source <> 'studio_manual'
     OR logged.actor_id IS DISTINCT FROM (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'co_instructor')::uuid
     OR logged.source_ref IS NOT NULL THEN
    RAISE EXCEPTION 'Declared studio_manual context was not captured';
  END IF;
END;
$$;
COMMIT;

-- Invalid declared context fails the content write and leaves no edit row.
DO $$
DECLARE
  rejected boolean := false;
BEGIN
  BEGIN
    PERFORM private.edit_log_context('invalid_source', NULL, NULL);
  EXCEPTION
    WHEN invalid_parameter_value THEN rejected := true;
  END;

  IF NOT rejected THEN
    RAISE EXCEPTION 'edit_log_context accepted an unsupported source';
  END IF;
END;
$$;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SELECT pg_catalog.set_config('app.studio_course_edit_log_source', 'invalid_source', true);
SELECT pg_catalog.set_config('app.studio_course_edit_log_actor', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SAVEPOINT invalid_context_probe;
SET LOCAL ROLE authenticated;
\set ON_ERROR_STOP off
UPDATE public.course_lessons
SET data = data || '{"description_markdown":"Must roll back"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';
\set invalid_context_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT invalid_context_probe;
RESET ROLE;
SELECT :'invalid_context_sqlstate' = '22023' AS invalid_context_rejected \gset
\if :invalid_context_rejected
\else
  \echo 'Invalid edit source did not fail with the expected error'
  \quit 1
\endif
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.studio_course_edits
    WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
  ) THEN
    RAISE EXCEPTION 'Invalid edit context left an audit row';
  END IF;
  IF (SELECT data->>'description_markdown' FROM public.course_lessons
      WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article') <> 'Co-instructor revision' THEN
    RAISE EXCEPTION 'Invalid edit context did not roll back the content write';
  END IF;
END;
$$;
ROLLBACK;

-- A client cannot invoke the private context function or mutate the audit table.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'instructor'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  denied boolean := false;
BEGIN
  BEGIN
    EXECUTE 'SELECT private.edit_log_context(''studio_ai'', NULL, NULL)';
    RAISE EXCEPTION 'Client called private edit context';
  EXCEPTION
    WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Authenticated client could declare edit context';
  END IF;
  IF has_function_privilege('authenticated', 'private.edit_log_context(text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated client retains context function privilege';
  END IF;
  IF has_table_privilege('authenticated', 'public.studio_course_edits', 'INSERT')
     OR has_table_privilege('authenticated', 'public.studio_course_edits', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.studio_course_edits', 'DELETE')
     OR has_table_privilege('service_role', 'public.studio_course_edits', 'INSERT')
     OR has_table_privilege('service_role', 'public.studio_course_edits', 'UPDATE')
     OR has_table_privilege('service_role', 'public.studio_course_edits', 'DELETE') THEN
    RAISE EXCEPTION 'A client or service role retains audit write privileges';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.studio_course_edits', 'SELECT') THEN
    RAISE EXCEPTION 'Authenticated role cannot query the admin-gated audit table';
  END IF;
END;
$$;
RESET ROLE;
ROLLBACK;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE visible_rows bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO visible_rows FROM public.studio_course_edits;
  IF visible_rows < 1 THEN
    RAISE EXCEPTION 'Admin cannot read course edit history';
  END IF;
END;
$$;
RESET ROLE;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'instructor'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE visible_rows bigint;
BEGIN
  SELECT pg_catalog.count(*) INTO visible_rows FROM public.studio_course_edits;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'Non-admin can read course edit history';
  END IF;
END;
$$;
RESET ROLE;
COMMIT;

-- Service-role writes with no user and no declared source are intentionally ignored.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
SELECT pg_catalog.set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE service_role;

UPDATE public.course_lessons
SET data = data || '{"description_markdown":"Unattributed service edit"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';

RESET ROLE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.studio_course_edits
    WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
  ) THEN
    RAISE EXCEPTION 'Unattributed service-role write created an edit row';
  END IF;
END;
$$;
COMMIT;

-- A regular transaction rollback removes both content and its audit row.
SELECT pg_catalog.count(*)::text AS rollback_log_count
FROM public.studio_course_edits
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
\gset
SELECT data->>'short_description' AS rollback_old_value
FROM public.course_lessons
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article'
\gset

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
UPDATE public.course_lessons
SET data = data || '{"short_description":"Transaction rollback probe"}'::jsonb
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.studio_course_edits
    WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
  ) THEN
    RAISE EXCEPTION 'Rollback probe did not write its transactional audit row';
  END IF;
END;
$$;
ROLLBACK;

SELECT pg_catalog.count(*)::text AS rollback_log_count_after
FROM public.studio_course_edits
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main')
\gset
SELECT data->>'short_description' AS rollback_new_value
FROM public.course_lessons
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-article'
\gset
SELECT :'rollback_log_count' = :'rollback_log_count_after'
   AND :'rollback_old_value' IS NOT DISTINCT FROM :'rollback_new_value'
   AS ordinary_rollback_clean \gset
\if :ordinary_rollback_clean
\else
  \echo 'Ordinary rollback left content or edit history behind'
  \quit 1
\endif

-- A deferred publication guard failure rolls back the trigger's immediate audit insert.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SAVEPOINT deferred_guard_probe;
SET LOCAL ROLE authenticated;

UPDATE public.courses
SET data = pg_catalog.jsonb_set(data, '{title}', '""'::jsonb, true)
WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_guard');

\set ON_ERROR_STOP off
SET CONSTRAINTS ALL IMMEDIATE;
\set deferred_guard_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
ROLLBACK TO SAVEPOINT deferred_guard_probe;
RESET ROLE;
SELECT :'deferred_guard_sqlstate' = 'P0001' AS deferred_guard_rejected \gset
\if :deferred_guard_rejected
\else
  \echo 'Publication guard did not reject the invalid course edit'
  \quit 1
\endif
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.studio_course_edits
    WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_guard')
  ) THEN
    RAISE EXCEPTION 'Deferred guard rollback left an edit row';
  END IF;
  IF (SELECT data->>'title' FROM public.courses WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'published_guard')) <> 'Initial course' THEN
    RAISE EXCEPTION 'Deferred guard rollback left invalid course content';
  END IF;
END;
$$;
ROLLBACK;

-- Deleting a draft lesson records its old values; deleting a course with cascades does not fail.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;
DELETE FROM public.course_lessons
WHERE course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main') AND id = 'lesson-delete';
RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'main');
  IF NOT FOUND
     OR logged.changes->0->>'op' <> 'delete'
     OR logged.changes->0->>'entity' <> 'lesson'
     OR logged.changes->0->>'label' <> 'Draft to delete'
     OR logged.changes->0->'fields'->'title'->>'old' <> 'Draft to delete'
     OR (logged.changes->0->'fields'->'title') ? 'new' THEN
    RAISE EXCEPTION 'Draft lesson delete did not preserve its old values';
  END IF;
END;
$$;
COMMIT;

BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', (SELECT id::text FROM pg_temp._studio_edit_actors WHERE kind = 'admin'), true);
SET LOCAL ROLE authenticated;
DELETE FROM public.courses WHERE id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'cascade');
RESET ROLE;

DO $$
DECLARE logged public.studio_course_edits%ROWTYPE;
BEGIN
  SELECT * INTO logged
  FROM public.studio_course_edits
  WHERE txid = pg_catalog.txid_current() AND course_id = (SELECT id FROM pg_temp._studio_edit_courses WHERE kind = 'cascade');
  IF NOT FOUND
     OR pg_catalog.jsonb_array_length(logged.changes) <> 1
     OR logged.changes->0->>'op' <> 'delete'
     OR logged.changes->0->>'entity' <> 'course' THEN
    RAISE EXCEPTION 'Course cascade delete did not remain safe and auditable';
  END IF;
END;
$$;
COMMIT;

-- Remove all test-owned rows, including audit rows with no course foreign key.
BEGIN;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '', true);
UPDATE public.courses c
SET published = false, archived_at = COALESCE(c.archived_at, pg_catalog.now())
FROM pg_temp._studio_edit_courses f
WHERE f.id = c.id;

DELETE FROM public.studio_course_edits e
USING pg_temp._studio_edit_courses c
WHERE c.id = e.course_id;

DELETE FROM public.courses c
USING pg_temp._studio_edit_courses f
WHERE f.id = c.id;

DELETE FROM auth.users u
USING pg_temp._studio_edit_actors a
WHERE a.id = u.id;
COMMIT;

\echo 'studio-course-edit-log integration assertions passed'
