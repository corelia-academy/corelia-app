BEGIN;

INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
  ('ab0e0000-0000-4000-8000-000000000001', 'abuse-actor@corelia.local', '{"full_name":"Abuse Actor"}'),
  ('ab0e0000-0000-4000-8000-000000000002', 'abuse-target@corelia.local', '{"full_name":"Abuse Target"}'),
  ('ab0e0000-0000-4000-8000-000000000003', 'abuse-other@corelia.local', '{"full_name":"Abuse Other"}');

-- Notification queue: a follow toggle flood stays bounded and opposite toggles cancel.
DO $$
DECLARE
  v_actor uuid := 'ab0e0000-0000-4000-8000-000000000001';
  v_target text := 'ab0e0000-0000-4000-8000-000000000002';
  v_other text := 'ab0e0000-0000-4000-8000-000000000003';
  i integer;
  n integer;
BEGIN
  INSERT INTO public.follows(follower_id, subject_type, subject_id) VALUES (v_actor, 'user', v_target);
  SELECT count(*) INTO n FROM private.notification_events WHERE actor = v_actor;
  IF n <> 1 THEN RAISE EXCEPTION 'Follow did not enqueue exactly one event: %', n; END IF;

  DELETE FROM public.follows WHERE follower_id = v_actor AND subject_type = 'user' AND subject_id = v_target;
  SELECT count(*) INTO n FROM private.notification_events WHERE actor = v_actor;
  IF n <> 0 THEN RAISE EXCEPTION 'Unfollow inside the window did not cancel the pending follow: %', n; END IF;

  FOR i IN 1..200 LOOP
    INSERT INTO public.follows(follower_id, subject_type, subject_id) VALUES (v_actor, 'user', v_target);
    DELETE FROM public.follows WHERE follower_id = v_actor AND subject_type = 'user' AND subject_id = v_target;
  END LOOP;
  INSERT INTO public.follows(follower_id, subject_type, subject_id) VALUES (v_actor, 'user', v_target);
  SELECT count(*) INTO n FROM private.notification_events WHERE actor = v_actor;
  IF n <> 1 THEN RAISE EXCEPTION 'Toggle flood was not coalesced: % events', n; END IF;

  -- Once processed, a later unfollow is a real event again.
  UPDATE private.notification_events SET processed_at = now() WHERE actor = v_actor;
  DELETE FROM public.follows WHERE follower_id = v_actor AND subject_type = 'user' AND subject_id = v_target;
  SELECT count(*) INTO n FROM private.notification_events WHERE actor = v_actor AND processed_at IS NULL AND data->>'operation' = 'DELETE';
  IF n <> 1 THEN RAISE EXCEPTION 'Unfollow after processing was not enqueued: %', n; END IF;

  -- Hourly per-actor cap: 120 recent social events stop further enqueueing.
  INSERT INTO private.notification_events(kind, target, actor, data, processed_at)
  SELECT 'project_liked', gen_random_uuid()::text, v_actor, '{"operation":"INSERT"}', now() FROM generate_series(1, 118);
  SELECT count(*) INTO n FROM private.notification_events WHERE actor = v_actor;
  IF n <> 120 THEN RAISE EXCEPTION 'Cap fixture is wrong: %', n; END IF;
  INSERT INTO public.follows(follower_id, subject_type, subject_id) VALUES (v_actor, 'user', v_other);
  SELECT count(*) INTO n FROM private.notification_events WHERE actor = v_actor;
  IF n <> 120 THEN RAISE EXCEPTION 'Per-actor hourly cap did not stop enqueueing: %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = v_actor AND subject_id = v_other) THEN
    RAISE EXCEPTION 'Capped actor source write was rejected';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_notifications_target_type') IS NULL THEN
    RAISE EXCEPTION 'user_notifications target/type index is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'cdn' AND allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif','image/avif'])
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'app' AND file_size_limit = 26214400
      AND 'application/pdf' = ANY(allowed_mime_types) AND NOT 'text/html' = ANY(allowed_mime_types)) THEN
    RAISE EXCEPTION 'Storage bucket limits are not configured';
  END IF;
END $$;

-- Storage policies: rendered certificates and final-assignment files.
INSERT INTO public.courses(id, instructor_id, slug, published, data) VALUES
  ('abuse-storage-course', 'ab0e0000-0000-4000-8000-000000000003', 'abuse-storage-course', true, '{"title":"Abuse storage course"}');
ALTER TABLE public.enrollments DISABLE TRIGGER trg_guard_enrollment_completion_mutation;
INSERT INTO public.enrollments(id, user_id, course_id, enrolled_at, last_accessed_at, completed_at, certificate_issued_at) VALUES
  ('ab0e0000-0000-4000-8000-000000000001_abuse-storage-course', 'ab0e0000-0000-4000-8000-000000000001', 'abuse-storage-course', now(), now(), now(), now()),
  ('ab0e0000-0000-4000-8000-000000000002_abuse-storage-course', 'ab0e0000-0000-4000-8000-000000000002', 'abuse-storage-course', now(), now(), null, null);
ALTER TABLE public.enrollments ENABLE TRIGGER trg_guard_enrollment_completion_mutation;

SELECT set_config('request.jwt.claims', '{"sub":"ab0e0000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO storage.objects(bucket_id, name, owner_id) VALUES
    ('cdn', 'certificates/ab0e0000-0000-4000-8000-000000000001/abuse-storage-course.png', 'ab0e0000-0000-4000-8000-000000000001');
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('cdn', 'certificates/ab0e0000-0000-4000-8000-000000000001/spam-1.png');
    RAISE EXCEPTION 'Certificate upload for a course without an issued certificate was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO storage.objects(bucket_id, name) VALUES ('cdn', 'certificates/ab0e0000-0000-4000-8000-000000000001/abuse-storage-course.svg');
    RAISE EXCEPTION 'Certificate upload with a non-png name was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  INSERT INTO storage.objects(bucket_id, name) VALUES
    ('app', 'final-assignment-submissions/abuse-storage-course/ab0e0000-0000-4000-8000-000000000001/a.pdf');
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"ab0e0000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  INSERT INTO storage.objects(bucket_id, name) VALUES
    ('app', 'final-assignment-submissions/abuse-storage-course/ab0e0000-0000-4000-8000-000000000003/a.pdf');
  RAISE EXCEPTION 'Final-assignment upload without enrollment was allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
DO $$ BEGIN
  INSERT INTO storage.objects(bucket_id, name) VALUES
    ('cdn', 'certificates/ab0e0000-0000-4000-8000-000000000003/abuse-storage-course.png');
  RAISE EXCEPTION 'Certificate upload without an enrollment was allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;
ROLLBACK;
