-- Corelia Studio: generation runtime (orchestrator in corelia-api, studio ADR-0005).
--
-- Model
--   studio_generations  one row per model call (provenance record + async request).
--                       The orchestrator inserts the row BEFORE calling the provider;
--                       UNIQUE (run_id, step_key, attempt) is the claim, so two
--                       overlapping ticks never submit the same attempt twice.
--                         submitting  claimed, provider call in flight
--                         submitted   provider accepted it (provider_request_id set)
--                         completed   output validated by the orchestrator
--                         failed      provider error or rejected output (output kept
--                                     for audit when there was one)
--                       model_id is the model the provider reports having served;
--                       requested_model_id is what was asked for.
--                       parent_generation_id links a retry to the attempt it replaces.
--
-- Run lifecycle (server only)
--   studio_start_run   locks the course, accepts idea / needs_update / not_passed with at
--                      least one path, creates the run and its 9 steps, course -> queued.
--                      Repeating the same run id for the same course returns it unchanged.
--                      research_status is not checked here: the evidence_ok gate belongs
--                      to the automatic queue fed by Catalog Research (A1), which does not
--                      exist yet; a manual start by an admin is accepted.
--   studio_finish_run  ends a running run: published -> course published,
--                      draft_failed (+ reason) -> course not_passed.
--
-- Authorization
--   Read: admin only (studio_can_write()), like the other studio_* tables.
--   Write: service role only. Runs and steps are no longer writable from the browser,
--   so every run goes through studio.start (admin check, server-side cost gate) and
--   the UI only reads run state. Deleting a course still cascades to its runs.

-- -----------------------------------------------------------------------------
-- 1) Runs and steps become read-only for clients
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['studio_runs', 'studio_run_steps'] LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', t || '_write_insert', t);
    EXECUTE format('DROP POLICY %I ON public.%I', t || '_write_update', t);
    EXECUTE format('DROP POLICY %I ON public.%I', t || '_write_delete', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Generation records
-- -----------------------------------------------------------------------------

CREATE TABLE public.studio_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_key text NOT NULL,
  attempt integer NOT NULL CHECK (attempt >= 0),
  agent_role text NOT NULL CHECK (agent_role IN ('A1', 'A2', 'A3', 'A4', 'A5', 'A6')),
  kind text NOT NULL CHECK (kind IN ('text', 'image', 'code', 'review', 'research')),
  origin text NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai', 'human_edit', 'external')),
  provider text NOT NULL CHECK (provider IN ('openai', 'anthropic')),
  requested_model_id text NOT NULL CHECK (length(btrim(requested_model_id)) > 0),
  model_id text,
  prompt_version text NOT NULL CHECK (length(btrim(prompt_version)) > 0),
  params jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(params) = 'object'),
  input jsonb NOT NULL CHECK (jsonb_typeof(input) = 'object'),
  parent_generation_id uuid REFERENCES public.studio_generations (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'submitting'
    CHECK (status IN ('submitting', 'submitted', 'completed', 'failed')),
  provider_request_id text,
  output jsonb,
  usage jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT studio_generations_step_fkey
    FOREIGN KEY (run_id, step_key) REFERENCES public.studio_run_steps (run_id, step_key) ON DELETE CASCADE,
  CONSTRAINT studio_generations_attempt_key UNIQUE (run_id, step_key, attempt),
  CONSTRAINT studio_generations_submitted_has_request
    CHECK (status IN ('submitting', 'failed') OR provider_request_id IS NOT NULL),
  CONSTRAINT studio_generations_completed_has_output
    CHECK (status <> 'completed' OR (output IS NOT NULL AND model_id IS NOT NULL AND completed_at IS NOT NULL)),
  CONSTRAINT studio_generations_failed_has_error
    CHECK (status <> 'failed' OR (error IS NOT NULL AND length(btrim(error)) > 0))
);

CREATE UNIQUE INDEX studio_generations_provider_request_key
  ON public.studio_generations (provider, provider_request_id) WHERE provider_request_id IS NOT NULL;
CREATE INDEX studio_generations_parent_idx
  ON public.studio_generations (parent_generation_id) WHERE parent_generation_id IS NOT NULL;

ALTER TABLE public.studio_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY studio_generations_admin_read ON public.studio_generations
  FOR SELECT TO authenticated USING ((SELECT public.studio_can_write()));

REVOKE ALL ON public.studio_generations FROM anon, authenticated;
GRANT SELECT ON public.studio_generations TO authenticated;

-- -----------------------------------------------------------------------------
-- 3) Run lifecycle functions (service role only)
-- -----------------------------------------------------------------------------

CREATE FUNCTION private.studio_start_run(p_course_id uuid, p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_existing_course uuid;
BEGIN
  -- Lock the course first so concurrent starts of the same course are serialized.
  SELECT c.status INTO v_status FROM public.studio_courses c WHERE c.id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT r.course_id INTO v_existing_course FROM public.studio_runs r WHERE r.id = p_run_id;
  IF FOUND THEN
    IF v_existing_course <> p_course_id THEN
      RAISE EXCEPTION 'run_id_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('run_id', p_run_id, 'created', false);
  END IF;

  IF v_status NOT IN ('idea', 'needs_update', 'not_passed') THEN
    RAISE EXCEPTION 'course_not_startable' USING ERRCODE = 'P0001', DETAIL = v_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.studio_course_paths p WHERE p.course_id = p_course_id) THEN
    RAISE EXCEPTION 'course_has_no_path' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.studio_runs (id, course_id) VALUES (p_run_id, p_course_id);
  INSERT INTO public.studio_run_steps (run_id, step_key)
  SELECT p_run_id, k
  FROM unnest(ARRAY[
    'brief', 'research', 'curriculum', 'curriculum_review', 'lessons',
    'lesson_review', 'structure_check', 'journey_test', 'publish'
  ]) AS k;
  UPDATE public.studio_courses SET status = 'queued' WHERE id = p_course_id;

  RETURN jsonb_build_object('run_id', p_run_id, 'created', true);
END;
$$;

CREATE FUNCTION private.studio_finish_run(p_run_id uuid, p_status text, p_reason text)
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

  UPDATE public.studio_courses
  SET status = CASE WHEN p_status = 'published' THEN 'published' ELSE 'not_passed' END
  WHERE id = v_course;
  RETURN true;
END;
$$;

CREATE FUNCTION public.studio_start_run(p_course_id uuid, p_run_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_start_run(p_course_id, p_run_id);
$$;

CREATE FUNCTION public.studio_finish_run(p_run_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_finish_run(p_run_id, p_status, p_reason);
$$;

REVOKE ALL ON FUNCTION private.studio_start_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.studio_finish_run(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_start_run(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_finish_run(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION
  private.studio_start_run(uuid, uuid),
  private.studio_finish_run(uuid, text, text),
  public.studio_start_run(uuid, uuid),
  public.studio_finish_run(uuid, text, text)
TO service_role;
