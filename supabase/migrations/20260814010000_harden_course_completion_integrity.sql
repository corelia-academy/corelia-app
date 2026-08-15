-- Harden course completion inputs used by milestone and credential eligibility.
-- Completion timestamps are server-owned; lesson progress must reference a
-- lesson that belongs to the same course.

CREATE OR REPLACE FUNCTION private.guard_enrollment_completion_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF (
    (TG_OP = 'INSERT' AND NEW.completed_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.completed_at IS DISTINCT FROM OLD.completed_at)
  )
  AND COALESCE(auth.role(), '') <> 'service_role'
  AND current_user NOT IN ('postgres', 'supabase_admin')
  AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'enrollments.completed_at is server-managed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_enrollment_completion_mutation ON public.enrollments;
CREATE TRIGGER trg_guard_enrollment_completion_mutation
  BEFORE INSERT OR UPDATE OF completed_at ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_enrollment_completion_mutation();

CREATE OR REPLACE FUNCTION private.validate_lesson_progress_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.course_lessons AS lesson
    WHERE lesson.id = NEW.lesson_id
      AND lesson.course_id = NEW.course_id
  ) THEN
    RAISE EXCEPTION 'lesson_progress.lesson_id does not belong to lesson_progress.course_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_lesson_progress_reference ON public.lesson_progress;
CREATE TRIGGER trg_validate_lesson_progress_reference
  BEFORE INSERT OR UPDATE OF course_id, lesson_id ON public.lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_lesson_progress_reference();

CREATE INDEX IF NOT EXISTS lesson_progress_user_course_lesson_completed_idx
  ON public.lesson_progress (user_id, course_id, lesson_id)
  WHERE completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.corelia_certificate_readiness(
  p_course_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lesson_total AS (
    SELECT COUNT(*)::bigint AS n
    FROM public.course_lessons
    WHERE course_id = p_course_id
  ),
  completed_distinct AS (
    SELECT COUNT(DISTINCT lesson.id)::bigint AS n
    FROM public.lesson_progress AS progress
    INNER JOIN public.course_lessons AS lesson
      ON lesson.id = progress.lesson_id
     AND lesson.course_id = progress.course_id
    WHERE progress.course_id = p_course_id
      AND progress.user_id = p_user_id
      AND progress.completed_at IS NOT NULL
  ),
  final_row AS (
    SELECT f.status::text AS st
    FROM public.final_assignment_submissions f
    WHERE f.course_id = p_course_id
      AND f.user_id = p_user_id
    ORDER BY f.submitted_at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'course_exists',
      EXISTS (SELECT 1 FROM public.courses c WHERE c.id = p_course_id),
    'lesson_total', (SELECT n FROM lesson_total),
    'completed_distinct', (SELECT n FROM completed_distinct),
    'all_lessons_complete',
      (SELECT lt.n > 0 AND cd.n >= lt.n FROM lesson_total lt, completed_distinct cd),
    'final_assignment_required',
      EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.id = p_course_id
          AND NULLIF(TRIM(c.data ->> 'final_assignment_title'), '') IS NOT NULL
      ),
    'final_submission_status',
      (SELECT st FROM final_row)
  );
$$;

REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.corelia_certificate_readiness(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.corelia_certificate_readiness(text, uuid) TO service_role;
