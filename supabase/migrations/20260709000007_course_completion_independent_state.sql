-- Track course completion independently from certificate issuance.
-- `completed_at` means the learner finished all course lessons.
-- `certificate_issued_at` remains the source of truth for the certificate vault.

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS enrollments_user_completed_idx
  ON public.enrollments (user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS enrollments_course_completed_idx
  ON public.enrollments (course_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

WITH lesson_counts AS (
  SELECT course_id, COUNT(*)::int AS lesson_total
  FROM public.course_lessons
  GROUP BY course_id
),
completed_counts AS (
  SELECT lp.user_id, lp.course_id, COUNT(DISTINCT lp.lesson_id)::int AS completed_total, MIN(lp.completed_at) AS first_completed_at
  FROM public.lesson_progress lp
  WHERE lp.completed_at IS NOT NULL
  GROUP BY lp.user_id, lp.course_id
)
UPDATE public.enrollments e
SET completed_at = COALESCE(e.completed_at, cc.first_completed_at, now())
FROM lesson_counts lc
JOIN completed_counts cc ON cc.course_id = lc.course_id
WHERE e.user_id = cc.user_id
  AND e.course_id = cc.course_id
  AND e.completed_at IS NULL
  AND lc.lesson_total > 0
  AND cc.completed_total >= lc.lesson_total;

CREATE OR REPLACE FUNCTION private.emit_activity_on_course_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.completed_at IS NULL)
  THEN
    PERFORM private.log_activity(
      NEW.user_id,
      'user.completed_course',
      'course',
      NEW.course_id,
      'user',
      NEW.user_id::text,
      jsonb_build_object(
        'enrollment_id', NEW.id,
        'completed_at', NEW.completed_at
      ),
      'public'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_course_completion ON public.enrollments;
CREATE TRIGGER trg_activity_course_completion
  AFTER INSERT OR UPDATE OF completed_at ON public.enrollments
  FOR EACH ROW
  EXECUTE FUNCTION private.emit_activity_on_course_completion();
