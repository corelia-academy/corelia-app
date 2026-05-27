-- Persistent demo seed for issue #96: Activity Feed + Follow System.
--
-- Local:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/seed-activity-feed-demo.sql
--
-- Test login accounts:
--   feed-demo-student1@corelia.test / Corelia123!
--   feed-demo-student2@corelia.test / Corelia123!
--   feed-demo-instructor@corelia.test / Corelia123!
--
-- The script is idempotent for the feed-demo-* dataset: it removes the old demo
-- rows first, then recreates them and lets activity triggers emit fresh events.

BEGIN;

DO $$
DECLARE
  v_student_1 uuid := '11111111-1111-4111-8111-111111111111';
  v_student_2 uuid := '22222222-2222-4222-8222-222222222222';
  v_student_3 uuid := '33333333-3333-4333-8333-333333333333';
  v_instructor uuid := '44444444-4444-4444-8444-444444444444';
  v_collaborator uuid := '55555555-5555-4555-8555-555555555555';
  v_course_id text := 'feed-demo-course';
  v_hackathon_id text := 'feed-demo-hackathon';
  v_project_id uuid;
  v_template_id uuid;
  v_heart_user uuid;
BEGIN
  -- Cleanup previous demo run. Most related rows cascade from auth.users,
  -- but hackathons use document.created_by rather than an FK.
  DELETE FROM public.hackathons WHERE id = v_hackathon_id;
  DELETE FROM auth.users
  WHERE id IN (v_student_1, v_student_2, v_student_3, v_instructor, v_collaborator)
     OR email LIKE 'feed-demo-heart-%@corelia.test';

  -- Login-capable auth users.
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      v_student_1,
      'authenticated',
      'authenticated',
      'feed-demo-student1@corelia.test',
      crypt('Corelia123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Feed Demo Student 1"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_student_2,
      'authenticated',
      'authenticated',
      'feed-demo-student2@corelia.test',
      crypt('Corelia123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Feed Demo Student 2"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_student_3,
      'authenticated',
      'authenticated',
      'feed-demo-student3@corelia.test',
      crypt('Corelia123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Feed Demo Student 3"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_instructor,
      'authenticated',
      'authenticated',
      'feed-demo-instructor@corelia.test',
      crypt('Corelia123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Feed Demo Instructor"}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_collaborator,
      'authenticated',
      'authenticated',
      'feed-demo-collaborator@corelia.test',
      crypt('Corelia123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Feed Demo Collaborator"}'::jsonb,
      now(),
      now()
    );

  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    u.id::text,
    u.id,
    jsonb_build_object(
      'sub', u.id::text,
      'email', u.email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  FROM auth.users u
  WHERE u.id IN (v_student_1, v_student_2, v_student_3, v_instructor, v_collaborator)
  ON CONFLICT (provider_id, provider) DO UPDATE
  SET identity_data = EXCLUDED.identity_data,
      updated_at = now();

  INSERT INTO public.profiles (
    id,
    role,
    email,
    username,
    full_name,
    bio,
    website,
    profile_public,
    instructor_headline,
    instructor_bio,
    instructor_organization
  )
  VALUES
    (
      v_student_1,
      'student',
      'feed-demo-student1@corelia.test',
      'feed-demo-student1',
      'Feed Demo Student 1',
      'Viewer account: follows the demo people and entities.',
      'https://corelia.test/feed-demo-student1',
      true,
      NULL,
      NULL,
      NULL
    ),
    (
      v_student_2,
      'student',
      'feed-demo-student2@corelia.test',
      'feed-demo-student2',
      'Feed Demo Student 2',
      'Actor account: enrolls, completes lessons, joins hackathons and publishes projects.',
      'https://corelia.test/feed-demo-student2',
      true,
      NULL,
      NULL,
      NULL
    ),
    (
      v_student_3,
      'student',
      'feed-demo-student3@corelia.test',
      'feed-demo-student3',
      'Feed Demo Student 3',
      'Extra public profile for followed-user activity and follower lists.',
      'https://corelia.test/feed-demo-student3',
      true,
      NULL,
      NULL,
      NULL
    ),
    (
      v_instructor,
      'instructor',
      'feed-demo-instructor@corelia.test',
      'feed-demo-instructor',
      'Feed Demo Instructor',
      'Instructor profile used by the feed demo course and hackathon.',
      'https://corelia.test/feed-demo-instructor',
      true,
      'Building activity-driven Web3 learning paths',
      'Publishes courses and hackathons for feed testing.',
      'Corelia Demo Lab'
    ),
    (
      v_collaborator,
      'student',
      'feed-demo-collaborator@corelia.test',
      'feed-demo-collaborator',
      'Feed Demo Collaborator',
      'Collaborator account for project join activity.',
      'https://corelia.test/feed-demo-collaborator',
      true,
      NULL,
      NULL,
      NULL
    )
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      full_name = EXCLUDED.full_name,
      bio = EXCLUDED.bio,
      website = EXCLUDED.website,
      profile_public = EXCLUDED.profile_public,
      instructor_headline = EXCLUDED.instructor_headline,
      instructor_bio = EXCLUDED.instructor_bio,
      instructor_organization = EXCLUDED.instructor_organization,
      updated_at = now();

  -- Published course + new sections/lessons.
  INSERT INTO public.courses (id, instructor_id, published, slug, data)
  VALUES (
    v_course_id,
    v_instructor,
    true,
    'feed-demo-course',
    jsonb_build_object(
      'title', 'Activity Feed Demo Course',
      'short_description', 'Seed course for Activity Feed testing.',
      'description', 'Use this course to test follows, activity events, bundling and feed links.',
      'level', 'beginner',
      'tags', jsonb_build_array('feed', 'social', 'demo')
    )
  );

  INSERT INTO public.course_sections (course_id, id, sort_order, data)
  VALUES
    (v_course_id, 'intro', 1, jsonb_build_object('title', 'Intro to Feed Signals')),
    (v_course_id, 'build', 2, jsonb_build_object('title', 'Build Social Learning Loops'));

  INSERT INTO public.course_lessons (course_id, id, section_id, sort_order, data)
  VALUES
    (v_course_id, 'lesson-1', 'intro', 1, jsonb_build_object('title', 'Why follow-based feeds matter')),
    (v_course_id, 'lesson-2', 'intro', 2, jsonb_build_object('title', 'Reading public activity')),
    (v_course_id, 'lesson-3', 'intro', 3, jsonb_build_object('title', 'Privacy filters')),
    (v_course_id, 'lesson-4', 'build', 1, jsonb_build_object('title', 'Bundling repeated actions')),
    (v_course_id, 'lesson-5', 'build', 2, jsonb_build_object('title', 'Realtime indicators'));

  INSERT INTO public.enrollments (id, user_id, course_id, enrolled_at, last_accessed_at)
  VALUES ('feed-demo-enrollment-student2', v_student_2, v_course_id, now() - interval '5 hours', now() - interval '1 hour');

  FOR i IN 1..5 LOOP
    INSERT INTO public.lesson_progress (id, user_id, course_id, lesson_id, completed_at, watch_seconds)
    VALUES (
      'feed-demo-progress-' || i,
      v_student_2,
      v_course_id,
      'lesson-' || i,
      now() - make_interval(mins => 60 - i),
      180 + (i * 10)
    );
  END LOOP;

  UPDATE public.enrollments
  SET certificate_issued_at = now() - interval '30 minutes'
  WHERE id = 'feed-demo-enrollment-student2';

  -- Public hackathon.
  INSERT INTO public.hackathons (id, status, document)
  VALUES (
    v_hackathon_id,
    'published',
    jsonb_build_object(
      'title', 'Activity Feed Demo Hackathon',
      'slug', 'feed-demo-hackathon',
      'tagline', 'Hackathon seed for feed testing.',
      'description', 'Use this hackathon to test registration, submission and status activity.',
      'created_by', v_instructor::text,
      'starts_at', (now() + interval '1 day')::text,
      'ends_at', (now() + interval '8 days')::text
    )
  );

  INSERT INTO public.hackathon_registrations (id, hackathon_id, user_id, document)
  VALUES (
    'feed-demo-registration-student2',
    v_hackathon_id,
    v_student_2,
    jsonb_build_object('team_name', 'Feed Demo Builders')
  );

  INSERT INTO public.hackathon_submissions (id, hackathon_id, user_id, document)
  VALUES (
    'feed-demo-submission-student2',
    v_hackathon_id,
    v_student_2,
    jsonb_build_object(
      'title', 'Realtime Activity Board',
      'summary', 'A demo submission that emits feed activity.'
    )
  );

  UPDATE public.hackathons
  SET status = 'running',
      document = document || jsonb_build_object('status_note', 'Demo status changed to running.')
  WHERE id = v_hackathon_id;

  -- Public project + collaborator + heart milestone.
  INSERT INTO public.projects (
    owner_id,
    title,
    summary,
    visibility,
    source_type,
    source_id,
    source_submission_id,
    demo_url,
    repo_url
  )
  VALUES (
    v_student_2,
    'Activity Feed Demo Project',
    'Public project used to test project follows, publish activity, collaborators and hearts milestones.',
    'public',
    'standalone',
    NULL,
    'feed-demo-project',
    'https://corelia.test/feed-demo-project',
    'https://github.com/corelia-academy/feed-demo-project'
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.project_collaborators (project_id, user_id, role)
  VALUES (v_project_id, v_collaborator, 'contributor');

  FOR i IN 1..10 LOOP
    v_heart_user := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_heart_user,
      'authenticated',
      'authenticated',
      'feed-demo-heart-' || i || '@corelia.test',
      crypt('Corelia123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Feed Demo Heart ' || i),
      now(),
      now()
    );

    INSERT INTO public.profiles (id, role, email, username, full_name, profile_public)
    VALUES (
      v_heart_user,
      'student',
      'feed-demo-heart-' || i || '@corelia.test',
      'feed-demo-heart-' || i,
      'Feed Demo Heart ' || i,
      true
    )
    ON CONFLICT (id) DO UPDATE
    SET profile_public = true,
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        updated_at = now();

    INSERT INTO public.project_hearts (project_id, user_id)
    VALUES (v_project_id, v_heart_user);
  END LOOP;

  -- GoTrue scans token columns as strings during password login, so keep them
  -- as empty strings instead of NULL for manually seeded auth users.
  UPDATE auth.users
  SET confirmation_token = coalesce(confirmation_token, ''),
      recovery_token = coalesce(recovery_token, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      phone_change = coalesce(phone_change, ''),
      phone_change_token = coalesce(phone_change_token, ''),
      reauthentication_token = coalesce(reauthentication_token, '')
  WHERE email LIKE 'feed-demo-%@corelia.test';

  -- Credential event.
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
    'Activity Feed Demo Credential',
    'Credential issued by the feed demo seed.',
    'https://corelia.test/feed-demo-credential.png',
    'Badge',
    'feed-demo-credential',
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
    minted_at,
    granted_by,
    granted_reason
  )
  VALUES (
    v_template_id,
    v_student_2,
    v_course_id,
    'feed-demo-credential-student2',
    'staging',
    'minted',
    'oc-feed-demo-student2',
    now() - interval '10 minutes',
    v_instructor,
    'Demo credential for Activity Feed testing'
  );

  -- Follow graph for Student 1 feed and follower-list UI.
  INSERT INTO public.follows (follower_id, subject_type, subject_id)
  VALUES
    (v_student_1, 'user', v_student_2::text),
    (v_student_1, 'user', v_student_3::text),
    (v_student_1, 'course', v_course_id),
    (v_student_1, 'hackathon', v_hackathon_id),
    (v_student_1, 'project', v_project_id::text),
    (v_student_2, 'user', v_student_3::text),
    (v_student_2, 'course', v_course_id),
    (v_student_2, 'hackathon', v_hackathon_id),
    (v_student_3, 'course', v_course_id),
    (v_student_3, 'hackathon', v_hackathon_id),
    (v_student_3, 'project', v_project_id::text);

  RAISE NOTICE 'Activity Feed demo seed created.';
  RAISE NOTICE 'Login: feed-demo-student1@corelia.test / Corelia123!';
  RAISE NOTICE 'Open: /feed, /u/feed-demo-student2, /courses/feed-demo-course, /hackathons/feed-demo-hackathon, /projects/%', v_project_id;
END $$;

COMMIT;
