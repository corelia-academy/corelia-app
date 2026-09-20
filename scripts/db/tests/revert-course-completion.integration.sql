-- Integration test: Reverting course completion (Issue #333)
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'learning_revert_completion' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Public learning revert wrapper must be SECURITY INVOKER';
  END IF;
  IF has_function_privilege('anon', 'private.learning_revert_completion_for_current_user(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'private.learning_revert_completion_for_current_user(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Private learning revert gate permissions are incorrect';
  END IF;
END $$;

INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
  ('eeee0000-0000-4000-8000-000000000333', 'revert-user@corelia.local', '{"full_name":"Revert Learner"}')
ON CONFLICT (id) DO NOTHING;

UPDATE public.profiles
   SET full_name = 'Revert Learner'
 WHERE id = 'eeee0000-0000-4000-8000-000000000333';

INSERT INTO public.courses(id, instructor_id, slug, published, data) VALUES
  ('course-revert-test', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', true, '{"title":"Revert Test Course"}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.course_sections(course_id, id, data) VALUES
  ('course-revert-test', 'section-revert', '{"title":"Section 1"}')
ON CONFLICT (course_id, id) DO NOTHING;

INSERT INTO public.course_lessons(course_id, id, section_id, sort_order, published, data) VALUES
  ('course-revert-test', 'lesson-revert-1', 'section-revert', 1, true, '{"title":"Lesson 1","lesson_format":"article","description_markdown":"Part 1"}'),
  ('course-revert-test', 'lesson-revert-2', 'section-revert', 2, true, '{"title":"Lesson 2","lesson_format":"article","description_markdown":"Part 2"}')
ON CONFLICT (course_id, id) DO NOTHING;

-- Seed the stable certificate code before the enrollment completion trigger runs.
INSERT INTO public.certificate_records (
  code, user_id, course_id, holder_name, course_title, instructor_name, issued_at
) VALUES (
  'CERT-REVERT-333',
  'eeee0000-0000-4000-8000-000000000333',
  'course-revert-test',
  'Revert Learner',
  'Revert Test Course',
  'Revert Learner',
  now() - interval '1 day'
) ON CONFLICT (code) DO NOTHING;

-- V-07: Fixture creation order - insert lesson progress BEFORE completed enrollment
INSERT INTO public.lesson_progress(id, user_id, course_id, lesson_id, completed_at) VALUES
  ('eeee0000-0000-4000-8000-000000000333_course-revert-test_lesson-revert-1', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', 'lesson-revert-1', now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-000000000333_course-revert-test_lesson-revert-2', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', 'lesson-revert-2', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET completed_at = EXCLUDED.completed_at;

-- Initial completed enrollment with an issued certificate
INSERT INTO public.enrollments(id, user_id, course_id, enrolled_at, last_accessed_at, completed_at, certificate_issued_at) VALUES
  ('eeee0000-0000-4000-8000-000000000333_course-revert-test', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', now() - interval '2 days', now() - interval '1 hour', now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  completed_at = EXCLUDED.completed_at,
  certificate_issued_at = EXCLUDED.certificate_issued_at;

-- V-10: Seed credential template, certificate record, and credential issuance
INSERT INTO public.credential_templates (
  id, scope_type, course_id, name, description, image_url, achievement_type, identifier_prefix, collection_symbol,
  trigger_type, trigger_rule, is_active
) VALUES (
  'eeee0000-0000-4000-8000-000000000334',
  'course',
  'course-revert-test',
  'Revert Test Certificate',
  'Certificate for completing Revert Test Course',
  'https://corelia.local/badge.png',
  'Badge',
  'COR-REV',
  'ocbadge',
  'auto',
  '{"completion_pct":100}',
  false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.credential_issuances (
  id, template_id, user_id, course_id, issuer_reference_id, network, status, minted_at
) VALUES (
  'eeee0000-0000-4000-8000-000000000335',
  'eeee0000-0000-4000-8000-000000000334',
  'eeee0000-0000-4000-8000-000000000333',
  'course-revert-test',
  'REV-CRED-333',
  'staging',
  'minted',
  now() - interval '1 day'
) ON CONFLICT (issuer_reference_id, network) DO NOTHING;

-- Set context as the learner (tests V-01: authenticated client calling public wrapper)
SELECT set_config('request.jwt.claim.sub', 'eeee0000-0000-4000-8000-000000000333', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

-- Test 1: Revert last lesson (V-01, V-10 assertions)
DO $$
DECLARE
  v_res jsonb;
  v_enr public.enrollments%ROWTYPE;
  v_p1 public.lesson_progress%ROWTYPE;
  v_p2 public.lesson_progress%ROWTYPE;
  v_cert_count integer;
  v_cred_count integer;
BEGIN
  v_res := public.learning_revert_completion('course-revert-test', 'last_lesson');
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Expected ok=true, got %', v_res;
  END IF;
  IF v_res->>'reverted_lesson_id' <> 'lesson-revert-2' THEN
    RAISE EXCEPTION 'Expected reverted_lesson_id=lesson-revert-2, got %', v_res;
  END IF;

  SELECT * INTO v_enr FROM public.enrollments WHERE course_id = 'course-revert-test' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
  IF v_enr.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Expected enrollment.completed_at to be NULL';
  END IF;
  IF v_enr.certificate_issued_at IS NULL THEN
    RAISE EXCEPTION 'Invariant violation: certificate_issued_at was cleared!';
  END IF;

  SELECT * INTO v_p1 FROM public.lesson_progress WHERE lesson_id = 'lesson-revert-1' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
  IF v_p1.completed_at IS NULL THEN
    RAISE EXCEPTION 'Lesson 1 should still be completed';
  END IF;

  SELECT * INTO v_p2 FROM public.lesson_progress WHERE lesson_id = 'lesson-revert-2' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
  IF v_p2.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Lesson 2 should be reverted to NULL';
  END IF;

  -- V-10: Verify certificate_records & credential_issuances are strictly preserved
  SELECT count(*) INTO v_cert_count FROM public.certificate_records WHERE user_id = 'eeee0000-0000-4000-8000-000000000333' AND course_id = 'course-revert-test' AND revoked_at IS NULL;
  IF v_cert_count <> 1 THEN
    RAISE EXCEPTION 'Invariant violation: expected 1 active certificate_records, got %', v_cert_count;
  END IF;

  SELECT count(*) INTO v_cred_count FROM public.credential_issuances WHERE user_id = 'eeee0000-0000-4000-8000-000000000333' AND course_id = 'course-revert-test' AND status = 'minted';
  IF v_cred_count <> 1 THEN
    RAISE EXCEPTION 'Invariant violation: expected 1 minted credential_issuances, got %', v_cred_count;
  END IF;
END $$;

-- Test 2 (V-02 verification): Cannot revert an incomplete enrollment
DO $$
BEGIN
  BEGIN
    PERFORM public.learning_revert_completion('course-revert-test', 'last_lesson');
    RAISE EXCEPTION 'Expected COURSE_NOT_COMPLETED exception, but call succeeded';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      -- Expected COURSE_NOT_COMPLETED
      NULL;
  END;
END $$;

-- V-07: Reset completion state for further tests: restore progress BEFORE enrollment
RESET ROLE;
UPDATE public.lesson_progress
   SET completed_at = now() - interval '1 day',
       completion_nonce = CASE
         WHEN reset_epoch > 0 THEN gen_random_uuid()
         ELSE completion_nonce
       END
 WHERE course_id = 'course-revert-test' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
UPDATE public.enrollments
   SET completed_at = now() - interval '1 day'
 WHERE course_id = 'course-revert-test' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
SET LOCAL ROLE authenticated;

-- Test 3 (V-04 verification): Revert with NULL or invalid mode must fail
DO $$
BEGIN
  -- Test with NULL mode
  BEGIN
    PERFORM public.learning_revert_completion('course-revert-test', NULL);
    RAISE EXCEPTION 'Expected INVALID_MODE exception on NULL mode, but call succeeded';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      NULL;
  END;

  -- Test with unrecognized mode
  BEGIN
    PERFORM public.learning_revert_completion('course-revert-test', 'unrecognized_mode');
    RAISE EXCEPTION 'Expected INVALID_MODE exception on unknown mode, but call succeeded';
  EXCEPTION
    WHEN SQLSTATE '22023' THEN
      NULL;
  END;
END $$;

-- Test 4: Revert reset all (V-10 assertions)
DO $$
DECLARE
  v_res jsonb;
  v_enr public.enrollments%ROWTYPE;
  v_p1 public.lesson_progress%ROWTYPE;
  v_cert_count integer;
  v_cred_count integer;
BEGIN
  v_res := public.learning_revert_completion('course-revert-test', 'reset_all');
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'Expected ok=true, got %', v_res;
  END IF;

  SELECT * INTO v_enr FROM public.enrollments WHERE course_id = 'course-revert-test' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
  IF v_enr.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Expected enrollment.completed_at to be NULL';
  END IF;
  IF v_enr.certificate_issued_at IS NULL THEN
    RAISE EXCEPTION 'Invariant violation: certificate_issued_at was cleared!';
  END IF;

  SELECT * INTO v_p1 FROM public.lesson_progress WHERE lesson_id = 'lesson-revert-1' AND user_id = 'eeee0000-0000-4000-8000-000000000333';
  IF v_p1.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Lesson 1 should now be reverted to NULL';
  END IF;

  -- V-10: Verify certificate_records & credential_issuances are strictly preserved
  SELECT count(*) INTO v_cert_count FROM public.certificate_records WHERE user_id = 'eeee0000-0000-4000-8000-000000000333' AND course_id = 'course-revert-test' AND revoked_at IS NULL;
  IF v_cert_count <> 1 THEN
    RAISE EXCEPTION 'Invariant violation: expected 1 active certificate_records, got %', v_cert_count;
  END IF;

  SELECT count(*) INTO v_cred_count FROM public.credential_issuances WHERE user_id = 'eeee0000-0000-4000-8000-000000000333' AND course_id = 'course-revert-test' AND status = 'minted';
  IF v_cred_count <> 1 THEN
    RAISE EXCEPTION 'Invariant violation: expected 1 minted credential_issuances, got %', v_cred_count;
  END IF;
END $$;

-- Test 5 (V-10 verification): Re-completion & No-Reissue Invariant
RESET ROLE;
-- Learner re-completes all lessons: progress first
UPDATE public.lesson_progress
   SET completed_at = clock_timestamp(),
       completion_nonce = gen_random_uuid()
 WHERE course_id = 'course-revert-test' AND user_id = 'eeee0000-0000-4000-8000-000000000333';

-- Learner re-completes course enrollment
UPDATE public.enrollments
   SET completed_at = clock_timestamp()
 WHERE course_id = 'course-revert-test' AND user_id = 'eeee0000-0000-4000-8000-000000000333';

-- Trigger certificate issuance check on re-completion
DO $$
BEGIN
  PERFORM private.ensure_certificate_record(
    'eeee0000-0000-4000-8000-000000000333'::uuid,
    'course-revert-test'::text,
    now()
  );
END $$;

DO $$
DECLARE
  v_cert_count integer;
  v_cred_count integer;
  v_cert_code text;
BEGIN
  -- Verify exactly 1 certificate record exists (no duplicate/reissue)
  SELECT count(*), min(code) INTO v_cert_count, v_cert_code
    FROM public.certificate_records
   WHERE user_id = 'eeee0000-0000-4000-8000-000000000333' AND course_id = 'course-revert-test';
  IF v_cert_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 certificate record, got %', v_cert_count;
  END IF;
  IF v_cert_code <> 'CERT-REVERT-333' THEN
    RAISE EXCEPTION 'Expected original certificate code CERT-REVERT-333, got %', v_cert_code;
  END IF;

  -- Verify credential_issuances count is exactly 1 (no duplicate)
  SELECT count(*) INTO v_cred_count
    FROM public.credential_issuances
   WHERE user_id = 'eeee0000-0000-4000-8000-000000000333' AND course_id = 'course-revert-test';
  IF v_cred_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 credential issuance record, got %', v_cred_count;
  END IF;
END $$;

ROLLBACK;
