-- Harden course report intake against client-side bypasses and moderation spam.

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_reports_contact_email_length_chk'
      AND conrelid = 'public.course_reports'::regclass
  ) THEN
    ALTER TABLE public.course_reports
      ADD CONSTRAINT course_reports_contact_email_length_chk
        CHECK (contact_email IS NULL OR char_length(contact_email) <= 320);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'course_reports_metadata_size_chk'
      AND conrelid = 'public.course_reports'::regclass
  ) THEN
    ALTER TABLE public.course_reports
      ADD CONSTRAINT course_reports_metadata_size_chk
        CHECK (pg_column_size(metadata) <= 8192);
  END IF;
END;
$do$;

CREATE UNIQUE INDEX IF NOT EXISTS course_reports_one_active_per_reporter_course_idx
  ON public.course_reports (reporter_id, course_id)
  WHERE status IN ('open', 'reviewing');

CREATE OR REPLACE FUNCTION private.guard_course_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hour_count int;
  v_day_count int;
  v_active_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  -- Never trust moderation fields supplied by the browser.
  NEW.reporter_id := v_uid;
  NEW.status := 'open';
  NEW.priority := 'normal';
  NEW.reviewer_id := NULL;
  NEW.resolution_note := NULL;
  NEW.resolved_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  NEW.details := btrim(NEW.details);
  NEW.contact_email := NULLIF(lower(btrim(COALESCE(NEW.contact_email, ''))), '');
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  IF NEW.contact_email IS NOT NULL
    AND NEW.contact_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  THEN
    RAISE EXCEPTION 'invalid contact email' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
    INTO v_active_count
  FROM public.course_reports
  WHERE reporter_id = v_uid
    AND course_id = NEW.course_id
    AND status IN ('open', 'reviewing');

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'active report already exists for this course' USING ERRCODE = '23505';
  END IF;

  SELECT count(*)
    INTO v_hour_count
  FROM public.course_reports
  WHERE reporter_id = v_uid
    AND created_at >= now() - interval '1 hour';

  IF v_hour_count >= 5 THEN
    RAISE EXCEPTION 'course report hourly limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)
    INTO v_day_count
  FROM public.course_reports
  WHERE reporter_id = v_uid
    AND created_at >= now() - interval '24 hours';

  IF v_day_count >= 20 THEN
    RAISE EXCEPTION 'course report daily limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_course_report_insert ON public.course_reports;
CREATE TRIGGER guard_course_report_insert
  BEFORE INSERT ON public.course_reports
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_course_report_insert();

GRANT EXECUTE ON FUNCTION private.guard_course_report_insert() TO authenticated;
