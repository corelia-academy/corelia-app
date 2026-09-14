-- Integration test: Reverting course completion (Issue #333)
BEGIN;

INSERT INTO auth.users(id, email, raw_user_meta_data) VALUES
  ('eeee0000-0000-4000-8000-000000000333', 'revert-user@corelia.local', '{"full_name":"Revert Learner"}')
ON CONFLICT (id) DO NOTHING;

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

-- Initial completed enrollment with an issued certificate
INSERT INTO public.enrollments(id, user_id, course_id, enrolled_at, completed_at, certificate_issued_at) VALUES
  ('eeee0000-0000-4000-8000-000000000333_course-revert-test', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', now() - interval '2 days', now() - interval '1 day', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET
  completed_at = EXCLUDED.completed_at,
  certificate_issued_at = EXCLUDED.certificate_issued_at;

INSERT INTO public.lesson_progress(id, user_id, course_id, lesson_id, completed_at) VALUES
  ('eeee0000-0000-4000-8000-000000000333_course-revert-test_lesson-revert-1', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', 'lesson-revert-1', now() - interval '2 days'),
  ('eeee0000-0000-4000-8000-000000000333_course-revert-test_lesson-revert-2', 'eeee0000-0000-4000-8000-000000000333', 'course-revert-test', 'lesson-revert-2', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE SET completed_at = EXCLUDED.completed_at;

-- Set context as the learner
SELECT set_config('request.jwt.claim.sub', 'eeee0000-0000-4000-8000-000000000333', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

-- Test 1: Revert last lesson
DO $$
DECLARE
  v_res jsonb;
  v_enr public.enrollments%ROWTYPE;
  v_p1 public.lesson_progress%ROWTYPE;
  v_p2 public.lesson_progress%ROWTYPE;
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
END $$;

-- Test 2: Revert reset all
DO $$
DECLARE
  v_res jsonb;
  v_enr public.enrollments%ROWTYPE;
  v_p1 public.lesson_progress%ROWTYPE;
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
END $$;

ROLLBACK;
