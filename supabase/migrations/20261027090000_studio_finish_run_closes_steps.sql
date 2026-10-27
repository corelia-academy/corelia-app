-- A run that is no longer running has no active step. studio_finish_run closes the steps it left active:
-- published -> done; draft_failed -> pending (interrupted, not the step that failed; the app marks that one failed
-- before calling this). Resume copies finished work only, so a pending step is simply run again.

CREATE OR REPLACE FUNCTION private.studio_finish_run(p_run_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course uuid;
BEGIN
  IF p_status NOT IN ('published', 'draft_failed') THEN
    RAISE EXCEPTION 'invalid_run_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_runs
  SET status = p_status,
      finished_at = now(),
      hold_reason = CASE WHEN p_status = 'draft_failed' THEN left(p_reason, 1000) END
  WHERE id = p_run_id AND status = 'running'
  RETURNING course_id INTO v_course;
  IF NOT FOUND THEN
    RETURN false; -- already finished by an earlier tick
  END IF;

  UPDATE public.studio_run_steps
  SET state = CASE WHEN p_status = 'published' THEN 'done' ELSE 'pending' END
  WHERE run_id = p_run_id AND state = 'active';

  UPDATE public.studio_courses
  SET status = CASE WHEN p_status = 'published' THEN 'published' ELSE 'not_passed' END
  WHERE id = v_course;
  RETURN true;
END;
$$;
