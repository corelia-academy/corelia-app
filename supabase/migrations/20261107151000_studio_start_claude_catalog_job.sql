-- Start a catalog research job that an external CLI coordinator runs (the MCP endpoint), pinned to the
-- external execution mode in the same transaction that creates it, so the server scheduler never sees
-- it as a server job. The MCP endpoint verifies the caller's session and admin role before calling this;
-- the function is service-role only, like studio_start_claude_course.

CREATE FUNCTION public.studio_start_claude_catalog_job(
  p_course_id uuid,
  p_job_id uuid,
  p_started_by uuid,
  p_agent_models jsonb DEFAULT '{}'::jsonb,
  p_agent_efforts jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := private.studio_start_catalog_job(p_course_id, p_job_id, 'manual', p_started_by);
  IF (v_result ->> 'created')::boolean THEN
    UPDATE public.studio_catalog_jobs
    SET execution_mode = 'claude_code',
        agent_models = p_agent_models,
        agent_efforts = p_agent_efforts
    WHERE id = p_job_id;
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.studio_start_claude_catalog_job(uuid, uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_start_claude_catalog_job(uuid, uuid, uuid, jsonb, jsonb) TO service_role;
