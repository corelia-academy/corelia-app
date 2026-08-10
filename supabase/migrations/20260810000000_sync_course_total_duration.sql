-- Course duration is derived data. Keep courses.data.total_duration_seconds
-- synchronized with the raw (unrounded) duration_seconds values on lessons.

CREATE OR REPLACE FUNCTION private.recalculate_course_total_duration(p_course_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_seconds bigint;
BEGIN
  IF p_course_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN COALESCE(l.data->>'duration_seconds', '') ~ '^[0-9]+([.][0-9]+)?$'
          THEN FLOOR((l.data->>'duration_seconds')::numeric)::bigint
        ELSE 0
      END
    ),
    0
  )
  INTO v_total_seconds
  FROM public.course_lessons AS l
  WHERE l.course_id = p_course_id;

  UPDATE public.courses AS c
  SET
    data = jsonb_set(
      COALESCE(c.data, '{}'::jsonb),
      '{total_duration_seconds}',
      to_jsonb(v_total_seconds),
      true
    ),
    updated_at = now()
  WHERE c.id = p_course_id
    AND c.data->'total_duration_seconds' IS DISTINCT FROM to_jsonb(v_total_seconds);
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_course_total_duration_from_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.recalculate_course_total_duration(OLD.course_id);
    RETURN OLD;
  END IF;

  PERFORM private.recalculate_course_total_duration(NEW.course_id);

  -- Defensive handling for direct SQL that moves a lesson between courses.
  IF TG_OP = 'UPDATE' AND OLD.course_id IS DISTINCT FROM NEW.course_id THEN
    PERFORM private.recalculate_course_total_duration(OLD.course_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_course_total_duration ON public.course_lessons;
CREATE TRIGGER trg_sync_course_total_duration
  AFTER INSERT OR UPDATE OF data, course_id OR DELETE
  ON public.course_lessons
  FOR EACH ROW
  EXECUTE FUNCTION private.sync_course_total_duration_from_lesson();

-- Retains the instructor-facing refresh control without letting the client
-- calculate and write a possibly stale total itself.
CREATE OR REPLACE FUNCTION public.refresh_course_total_duration(p_course_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL
     OR NOT private.can_manage_course(p_course_id, v_user_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  PERFORM private.recalculate_course_total_duration(p_course_id);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_course_total_duration(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_course_total_duration(text) TO authenticated, service_role;

-- Repair existing rows, including legacy values stored as strings or stale totals.
DO $$
DECLARE
  v_course_id text;
BEGIN
  FOR v_course_id IN SELECT id FROM public.courses LOOP
    PERFORM private.recalculate_course_total_duration(v_course_id);
  END LOOP;
END;
$$;
