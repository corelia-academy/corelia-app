-- Corelia Studio - resuming a run keeps the video stage (step A8) of the lessons it copies.
-- Without this a resumed run asked Gemini again for every video lesson, even for lessons already accepted.
--
-- studio_copy_generations copies the lessons of the failed run; its video rows are copied too, for the lessons it
-- copies: the judged candidates (completed) and the fallback (failed, failure_kind rejected). Their attempt numbers
-- are kept, since one lesson has several judged candidates; the other copies keep attempt 0 as before.
-- A transport or provider failure is not copied: the stage retries it. The run step lesson_video is created first,
-- because each generation refers to its run step.
-- studio_resume_run is unchanged: it already passes every lesson it copies to this function.

CREATE OR REPLACE FUNCTION private.studio_copy_generations(p_run_id uuid, p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_copied integer;
  v_video integer := 0;
BEGIN
  -- The generations the caller names, as before.
  WITH copied AS (
    INSERT INTO public.studio_generations (
      run_id, step_key, lesson_id, locale, attempt, agent_role, kind, origin, provider, requested_model_id, model_id,
      prompt_version, params, input, parent_generation_id, status, provider_request_id, output, usage,
      created_at, submitted_at, completed_at
    )
    SELECT p_run_id, g.step_key, g.lesson_id, g.locale, 0, g.agent_role, g.kind, 'resumed', g.provider, g.requested_model_id, g.model_id,
           g.prompt_version, g.params, g.input, g.id, 'completed', 'resume:' || g.id::text, g.output, g.usage,
           g.created_at, g.submitted_at, g.completed_at
    FROM public.studio_generations g
    WHERE g.id = ANY (p_ids)
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_copied FROM copied;

  -- The video stage of the lessons copied above: judged candidates and the fallback.
  IF EXISTS (
    SELECT 1 FROM public.studio_generations g
    WHERE g.step_key = 'lesson_video' AND (g.status = 'completed' OR (g.status = 'failed' AND g.failure_kind = 'rejected'))
      AND g.run_id IN (SELECT DISTINCT s.run_id FROM public.studio_generations s WHERE s.id = ANY (p_ids))
      AND g.lesson_id IN (SELECT DISTINCT s.lesson_id FROM public.studio_generations s WHERE s.id = ANY (p_ids) AND s.lesson_id IS NOT NULL)
  ) THEN
    -- Each generation refers to its run step, so the step row comes first.
    INSERT INTO public.studio_run_steps (run_id, step_key, state) VALUES (p_run_id, 'lesson_video', 'active')
    ON CONFLICT (run_id, step_key) DO NOTHING;

    WITH video AS (
      INSERT INTO public.studio_generations (
        run_id, step_key, lesson_id, locale, attempt, agent_role, kind, origin, provider, requested_model_id, model_id,
        prompt_version, params, input, parent_generation_id, status, provider_request_id, output, usage,
        created_at, submitted_at, completed_at, failure_kind, error
      )
      SELECT p_run_id, g.step_key, g.lesson_id, g.locale, g.attempt, g.agent_role, g.kind, 'resumed', g.provider, g.requested_model_id, g.model_id,
             g.prompt_version, g.params, g.input, g.id, g.status,
             CASE WHEN g.status = 'completed' THEN 'resume:' || g.id::text ELSE NULL END,
             g.output, g.usage, g.created_at, g.submitted_at, g.completed_at, g.failure_kind, g.error
      FROM public.studio_generations g
      WHERE g.step_key = 'lesson_video' AND (g.status = 'completed' OR (g.status = 'failed' AND g.failure_kind = 'rejected'))
        AND g.run_id IN (SELECT DISTINCT s.run_id FROM public.studio_generations s WHERE s.id = ANY (p_ids))
        AND g.lesson_id IN (SELECT DISTINCT s.lesson_id FROM public.studio_generations s WHERE s.id = ANY (p_ids) AND s.lesson_id IS NOT NULL)
      RETURNING 1
    )
    SELECT count(*)::integer INTO v_video FROM video;
  END IF;

  RETURN v_copied + v_video;
END;
$function$;
