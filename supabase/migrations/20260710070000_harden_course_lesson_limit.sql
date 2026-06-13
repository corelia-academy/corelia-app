-- Enforce the per-course lesson cap declared in tier_limits at the database edge.

CREATE OR REPLACE FUNCTION private.enforce_course_lesson_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_owner uuid;
  v_tier text;
  v_limit int;
  v_current int;
BEGIN
  -- Service-role maintenance/backfills can bypass this guard; authenticated
  -- creators and co-instructors are capped by the course owner's tier.
  IF auth.uid() IS NULL OR public.is_admin_or_support() THEN
    RETURN NEW;
  END IF;

  SELECT instructor_id
    INTO v_owner
  FROM public.courses
  WHERE id = NEW.course_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  v_tier := private.current_creator_tier(v_owner);

  SELECT course_lessons_per_course_limit
    INTO v_limit
  FROM public.tier_limits
  WHERE tier = v_tier;

  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int
    INTO v_current
  FROM public.course_lessons
  WHERE course_id = NEW.course_id;

  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'course_lesson_limit_exceeded:%', v_limit
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_course_lesson_limit ON public.course_lessons;
CREATE TRIGGER trg_enforce_course_lesson_limit
  BEFORE INSERT ON public.course_lessons
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_course_lesson_limit();
