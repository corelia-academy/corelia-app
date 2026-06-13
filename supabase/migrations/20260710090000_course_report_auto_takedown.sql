-- Escalate repeated unique course reports into automatic safety takedown.
-- This is intentionally conservative: owner reports are rejected and thresholds
-- count unique non-owner reporters within a 7-day window.

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
  v_course_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT c.instructor_id
    INTO v_course_owner
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF v_course_owner IS NULL THEN
    RAISE EXCEPTION 'course not found' USING ERRCODE = '23503';
  END IF;

  IF v_course_owner = v_uid THEN
    RAISE EXCEPTION 'course owner cannot report own course' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION private.handle_course_report_threshold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_owner uuid;
  v_published boolean;
  v_copyright_count int := 0;
  v_spam_count int := 0;
  v_reason text := NULL;
  v_count int := 0;
BEGIN
  IF NEW.status <> 'open' OR NEW.reason NOT IN ('copyright', 'spam') THEN
    RETURN NEW;
  END IF;

  SELECT c.instructor_id, c.published
    INTO v_owner, v_published
  FROM public.courses c
  WHERE c.id = NEW.course_id;

  IF v_owner IS NULL OR NEW.reporter_id = v_owner THEN
    RETURN NEW;
  END IF;

  SELECT count(DISTINCT r.reporter_id)
    INTO v_copyright_count
  FROM public.course_reports r
  WHERE r.course_id = NEW.course_id
    AND r.reason = 'copyright'
    AND r.status IN ('open', 'reviewing')
    AND r.created_at >= now() - interval '7 days'
    AND r.reporter_id IS DISTINCT FROM v_owner;

  SELECT count(DISTINCT r.reporter_id)
    INTO v_spam_count
  FROM public.course_reports r
  WHERE r.course_id = NEW.course_id
    AND r.reason = 'spam'
    AND r.status IN ('open', 'reviewing')
    AND r.created_at >= now() - interval '7 days'
    AND r.reporter_id IS DISTINCT FROM v_owner;

  IF v_copyright_count >= 3 THEN
    v_reason := 'copyright';
    v_count := v_copyright_count;
  ELSIF v_spam_count >= 5 THEN
    v_reason := 'spam';
    v_count := v_spam_count;
  END IF;

  IF v_reason IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.course_reports
  SET
    status = 'reviewing',
    priority = 'urgent',
    updated_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'autoEscalated', true,
      'autoEscalatedAt', now(),
      'autoEscalationReason', v_reason,
      'autoEscalationReportCount', v_count
    )
  WHERE course_id = NEW.course_id
    AND reason = v_reason
    AND status = 'open'
    AND created_at >= now() - interval '7 days';

  IF v_published = true THEN
    UPDATE public.courses
    SET
      published = false,
      updated_at = now(),
      data = COALESCE(data, '{}'::jsonb) || jsonb_build_object(
        'moderation_status', 'auto_unpublished',
        'moderation_reason', v_reason,
        'moderation_report_count', v_count,
        'moderation_triggered_at', now()
      )
    WHERE id = NEW.course_id
      AND published = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS handle_course_report_threshold ON public.course_reports;
CREATE TRIGGER handle_course_report_threshold
  AFTER INSERT ON public.course_reports
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_course_report_threshold();

REVOKE ALL ON FUNCTION private.handle_course_report_threshold() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.handle_course_report_threshold() TO authenticated;
