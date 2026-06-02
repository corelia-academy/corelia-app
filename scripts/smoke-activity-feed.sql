-- Smoke test for issue #96: Activity Feed + Follow System.
--
-- Local:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/smoke-activity-feed.sql
--
-- Staging/prod:
--   Run against the target database with ON_ERROR_STOP=1. The script wraps all
--   writes in a transaction and rolls back at the end, so no fixture data is kept.

BEGIN;

CREATE TEMP TABLE feed_smoke_ctx (
  key text PRIMARY KEY,
  value text NOT NULL
) ON COMMIT DROP;

GRANT SELECT ON feed_smoke_ctx TO authenticated;

DO $$
DECLARE
  v_suffix text := lower(substr(md5(clock_timestamp()::text), 1, 12));
  v_follower uuid := gen_random_uuid();
  v_actor uuid := gen_random_uuid();
  v_target uuid := gen_random_uuid();
  v_instructor uuid := gen_random_uuid();
  v_collaborator uuid := gen_random_uuid();
  v_course_id text := 'feed-smoke-course-' || v_suffix;
  v_hackathon_id text := 'feed-smoke-hackathon-' || v_suffix;
  v_project_id uuid;
  v_template_id uuid;
  v_heart_user uuid;
BEGIN
  INSERT INTO feed_smoke_ctx (key, value)
  VALUES
    ('follower_id', v_follower::text),
    ('actor_id', v_actor::text),
    ('target_id', v_target::text),
    ('instructor_id', v_instructor::text),
    ('course_id', v_course_id),
    ('hackathon_id', v_hackathon_id);

  INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_follower, 'authenticated', 'authenticated', 'feed-follower-' || v_suffix || '@example.test', '', now(), now(), now()),
    (v_actor, 'authenticated', 'authenticated', 'feed-actor-' || v_suffix || '@example.test', '', now(), now(), now()),
    (v_target, 'authenticated', 'authenticated', 'feed-target-' || v_suffix || '@example.test', '', now(), now(), now()),
    (v_instructor, 'authenticated', 'authenticated', 'feed-instructor-' || v_suffix || '@example.test', '', now(), now(), now()),
    (v_collaborator, 'authenticated', 'authenticated', 'feed-collaborator-' || v_suffix || '@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, role, email, username, full_name, profile_public)
  VALUES
    (v_follower, 'student', 'feed-follower-' || v_suffix || '@example.test', 'feed-follower-' || v_suffix, 'Feed Follower', true),
    (v_actor, 'student', 'feed-actor-' || v_suffix || '@example.test', 'feed-actor-' || v_suffix, 'Feed Actor', true),
    (v_target, 'student', 'feed-target-' || v_suffix || '@example.test', 'feed-target-' || v_suffix, 'Feed Target', true),
    (v_instructor, 'instructor', 'feed-instructor-' || v_suffix || '@example.test', 'feed-instructor-' || v_suffix, 'Feed Instructor', true),
    (v_collaborator, 'student', 'feed-collaborator-' || v_suffix || '@example.test', 'feed-collaborator-' || v_suffix, 'Feed Collaborator', true)
  ON CONFLICT (id) DO UPDATE
  SET profile_public = true,
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name;

  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES (
    v_course_id,
    v_instructor,
    true,
    v_course_id,
    jsonb_build_object('title', 'Feed Smoke Course')
  );

  INSERT INTO public.course_sections (course_id, id, sort_order, data)
  VALUES (
    v_course_id,
    'intro',
    1,
    jsonb_build_object('title', 'Intro Section')
  );

  INSERT INTO public.enrollments (id, user_id, course_id, enrolled_at, last_accessed_at)
  VALUES ('feed-enrollment-' || v_suffix, v_actor, v_course_id, now(), now());

  UPDATE public.enrollments
  SET certificate_issued_at = now()
  WHERE id = 'feed-enrollment-' || v_suffix;

  INSERT INTO public.lesson_progress (id, user_id, course_id, lesson_id, completed_at, watch_seconds)
  VALUES ('feed-lesson-progress-' || v_suffix, v_actor, v_course_id, 'lesson-1', now(), 120);

  INSERT INTO public.hackathons (id, status, document)
  VALUES (
    v_hackathon_id,
    'published',
    jsonb_build_object(
      'title', 'Feed Smoke Hackathon',
      'slug', v_hackathon_id,
      'created_by', v_instructor::text
    )
  );

  INSERT INTO public.hackathon_registrations (id, hackathon_id, user_id, document)
  VALUES ('feed-registration-' || v_suffix, v_hackathon_id, v_actor, '{}'::jsonb);

  INSERT INTO public.hackathon_submissions (id, hackathon_id, user_id, document)
  VALUES ('feed-submission-' || v_suffix, v_hackathon_id, v_actor, '{}'::jsonb);

  UPDATE public.hackathons
  SET status = 'running'
  WHERE id = v_hackathon_id;

  INSERT INTO public.projects (owner_id, title, summary, visibility, source_type, source_id, source_submission_id)
  VALUES (v_actor, 'Feed Smoke Project', 'Smoke project for activity feed.', 'public', 'standalone', NULL, 'feed-project-' || v_suffix)
  RETURNING id INTO v_project_id;

  INSERT INTO feed_smoke_ctx (key, value)
  VALUES ('project_id', v_project_id::text);

  INSERT INTO public.project_collaborators (project_id, user_id, role)
  VALUES (v_project_id, v_collaborator, 'contributor');

  FOR i IN 1..10 LOOP
    v_heart_user := gen_random_uuid();

    INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (v_heart_user, 'authenticated', 'authenticated', 'feed-heart-' || i || '-' || v_suffix || '@example.test', '', now(), now(), now());

    INSERT INTO public.profiles (id, role, email, username, full_name, profile_public)
    VALUES (
      v_heart_user,
      'student',
      'feed-heart-' || i || '-' || v_suffix || '@example.test',
      'feed-heart-' || i || '-' || v_suffix,
      'Feed Heart ' || i,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET profile_public = true;

    INSERT INTO public.project_hearts (project_id, user_id)
    VALUES (v_project_id, v_heart_user);
  END LOOP;

  INSERT INTO public.credential_templates (
    scope_type,
    course_id,
    name,
    description,
    image_url,
    achievement_type,
    identifier_prefix,
    collection_symbol,
    trigger_type,
    is_active
  )
  VALUES (
    'course',
    v_course_id,
    'Feed Smoke Credential',
    'Smoke credential for activity feed.',
    'https://example.test/feed-smoke.png',
    'Badge',
    'feed-smoke-' || v_suffix,
    'corelia-courses',
    'manual',
    true
  )
  RETURNING id INTO v_template_id;

  INSERT INTO public.credential_issuances (
    template_id,
    user_id,
    course_id,
    issuer_reference_id,
    network,
    status,
    oc_credential_id,
    minted_at
  )
  VALUES (
    v_template_id,
    v_actor,
    v_course_id,
    'feed-smoke-credential-' || v_suffix,
    'staging',
    'minted',
    'oc-feed-smoke-' || v_suffix,
    now()
  );

  INSERT INTO public.follows (follower_id, subject_type, subject_id)
  VALUES (v_actor, 'user', v_target::text);
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.sub', (SELECT value FROM feed_smoke_ctx WHERE key = 'follower_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

INSERT INTO public.follows (follower_id, subject_type, subject_id)
VALUES
  ((SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'follower_id'), 'user', (SELECT value FROM feed_smoke_ctx WHERE key = 'actor_id')),
  ((SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'follower_id'), 'course', (SELECT value FROM feed_smoke_ctx WHERE key = 'course_id')),
  ((SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'follower_id'), 'hackathon', (SELECT value FROM feed_smoke_ctx WHERE key = 'hackathon_id')),
  ((SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'follower_id'), 'project', (SELECT value FROM feed_smoke_ctx WHERE key = 'project_id'));

SET LOCAL row_security = on;

DO $$
DECLARE
  v_expected_verbs text[] := ARRAY[
    'user.enrolled_course',
    'user.completed_course',
    'user.completed_section',
    'user.registered_hackathon',
    'user.submitted_hackathon',
    'hackathon.status_changed',
    'user.published_project',
    'user.joined_project',
    'project.received_hearts_milestone',
    'course.published',
    'course.new_section',
    'user.earned_credential',
    'user.followed_user'
  ];
  v_missing text[];
  v_actor_follow_events integer;
  v_course_followers integer;
BEGIN
  SELECT array_agg(v)
  INTO v_missing
  FROM unnest(v_expected_verbs) AS v
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.get_feed_v1(NULL, 100, NULL) e
    WHERE e.verb = v
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing expected feed verbs: %', v_missing;
  END IF;

  SELECT count(*)::integer
  INTO v_actor_follow_events
  FROM public.get_feed_v1(NULL, 100, NULL) e
  WHERE e.verb = 'user.followed_user'
    AND e.actor_id = (SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'actor_id');

  IF v_actor_follow_events < 1 THEN
    RAISE EXCEPTION 'Expected actor follow event to appear while follower follows actor';
  END IF;

  SELECT count(*)::integer
  INTO v_course_followers
  FROM public.list_followers_v1('course', (SELECT value FROM feed_smoke_ctx WHERE key = 'course_id'), 5);

  IF v_course_followers <> 1 THEN
    RAISE EXCEPTION 'Expected follower preview RPC to return 1 course follower, got %', v_course_followers;
  END IF;
END $$;

RESET ROLE;

UPDATE public.projects
SET visibility = 'private'
WHERE id = (SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'project_id');

SET LOCAL ROLE authenticated;
SET LOCAL row_security = on;
SELECT set_config('request.jwt.claim.sub', (SELECT value FROM feed_smoke_ctx WHERE key = 'follower_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
  v_project_events integer;
BEGIN
  SELECT count(*)::integer
  INTO v_project_events
  FROM public.get_feed_v1(NULL, 100, NULL) e
  WHERE e.object_type = 'project'
    AND e.object_id = (SELECT value FROM feed_smoke_ctx WHERE key = 'project_id');

  IF v_project_events <> 0 THEN
    RAISE EXCEPTION 'Expected private project activity to be hidden from follower feed, got % events', v_project_events;
  END IF;
END $$;

DELETE FROM public.follows
WHERE follower_id = (SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'follower_id')
  AND subject_type = 'user'
  AND subject_id = (SELECT value FROM feed_smoke_ctx WHERE key = 'actor_id');

DO $$
DECLARE
  v_actor_follow_events integer;
BEGIN
  SELECT count(*)::integer
  INTO v_actor_follow_events
  FROM public.get_feed_v1(NULL, 100, NULL) e
  WHERE e.verb = 'user.followed_user'
    AND e.actor_id = (SELECT value::uuid FROM feed_smoke_ctx WHERE key = 'actor_id');

  IF v_actor_follow_events <> 0 THEN
    RAISE EXCEPTION 'Expected actor-only follow event to disappear after unfollow';
  END IF;
END $$;

RESET ROLE;

ROLLBACK;

SELECT 'activity feed smoke test passed' AS result;
