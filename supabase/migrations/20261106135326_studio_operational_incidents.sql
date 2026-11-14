-- Corelia Studio: durable, deduplicated operations incidents reported by the
-- Claude Code coordinator. Individual attempts remain in studio_generations;
-- this table tracks issues that need operational or code follow-up.

ALTER TABLE public.studio_generations
  DROP CONSTRAINT IF EXISTS studio_generations_failure_kind_check;

ALTER TABLE public.studio_generations
  ADD CONSTRAINT studio_generations_failure_kind_check
    CHECK (failure_kind IN ('transport', 'provider', 'rejected', 'system'));

CREATE TABLE public.studio_operational_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL CHECK (length(fingerprint) <= 300),
  error_code text NOT NULL CHECK (error_code ~ '^[A-Z][A-Z0-9_]{0,79}$'),
  category text NOT NULL CHECK (category IN (
    'mcp', 'runtime', 'configuration', 'dependency', 'database', 'contract', 'external_service', 'unknown'
  )),
  component text NOT NULL CHECK (component ~ '^[a-z0-9][a-z0-9._-]{0,119}$'),
  environment text NOT NULL DEFAULT 'unknown'
    CHECK (environment IN ('local', 'staging', 'production', 'unknown')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
  impact text NOT NULL DEFAULT '' CHECK (length(impact) <= 2000),
  priority text CHECK (priority IN ('P0', 'P1', 'P2', 'P3', 'P4', 'P5')),
  priority_source text NOT NULL DEFAULT 'coordinator'
    CHECK (priority_source IN ('coordinator', 'operator')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'triaged', 'in_progress', 'blocked', 'resolved', 'duplicate', 'wont_fix')),
  reported_by text NOT NULL DEFAULT 'coordinator'
    CHECK (length(btrim(reported_by)) BETWEEN 1 AND 100),
  occurrence_count integer NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_run_id uuid REFERENCES public.studio_runs (id) ON DELETE SET NULL,
  last_catalog_job_id uuid REFERENCES public.studio_catalog_jobs (id) ON DELETE SET NULL,
  last_generation_id uuid REFERENCES public.studio_generations (id) ON DELETE SET NULL,
  last_step_key text,
  last_agent_role text,
  assigned_to text CHECK (assigned_to IS NULL OR length(assigned_to) <= 200),
  operator_notes text NOT NULL DEFAULT '' CHECK (length(operator_notes) <= 8000),
  resolution_summary text CHECK (resolution_summary IS NULL OR length(resolution_summary) <= 4000),
  duplicate_of uuid REFERENCES public.studio_operational_incidents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT studio_operational_incidents_duplicate_target CHECK (
    (status = 'duplicate' AND duplicate_of IS NOT NULL AND duplicate_of <> id)
    OR (status <> 'duplicate' AND duplicate_of IS NULL)
  ),
  CONSTRAINT studio_operational_incidents_resolution_time CHECK (
    (status IN ('resolved', 'duplicate', 'wont_fix')) = (resolved_at IS NOT NULL)
  ),
  CONSTRAINT studio_operational_incidents_resolution_summary CHECK (
    status NOT IN ('resolved', 'wont_fix')
    OR (resolution_summary IS NOT NULL AND length(btrim(resolution_summary)) > 0)
  ),
  CONSTRAINT studio_operational_incidents_seen_order CHECK (last_seen_at >= first_seen_at)
);

CREATE UNIQUE INDEX studio_operational_incidents_active_fingerprint_key
  ON public.studio_operational_incidents (fingerprint)
  WHERE status IN ('open', 'triaged', 'in_progress', 'blocked');
CREATE INDEX studio_operational_incidents_status_last_seen_idx
  ON public.studio_operational_incidents (status, last_seen_at DESC);
CREATE INDEX studio_operational_incidents_priority_last_seen_idx
  ON public.studio_operational_incidents (priority, last_seen_at DESC);
CREATE INDEX studio_operational_incidents_last_run_idx
  ON public.studio_operational_incidents (last_run_id, last_seen_at DESC)
  WHERE last_run_id IS NOT NULL;

ALTER TABLE public.studio_generations
  ADD COLUMN operational_incident_id uuid
    REFERENCES public.studio_operational_incidents (id) ON DELETE SET NULL;
CREATE INDEX studio_generations_operational_incident_idx
  ON public.studio_generations (operational_incident_id)
  WHERE operational_incident_id IS NOT NULL;

ALTER TABLE public.studio_operational_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY studio_operational_incidents_admin_read
  ON public.studio_operational_incidents
  FOR SELECT TO authenticated
  USING ((SELECT public.studio_can_write()));

REVOKE ALL ON public.studio_operational_incidents FROM anon, authenticated;
GRANT SELECT ON public.studio_operational_incidents TO authenticated;
GRANT ALL ON public.studio_operational_incidents TO service_role;

CREATE TRIGGER trg_studio_operational_incidents_touch_updated_at
  BEFORE UPDATE ON public.studio_operational_incidents
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

CREATE FUNCTION private.studio_report_external_task_failure(
  p_generation_id uuid,
  p_failure_kind text,
  p_error text,
  p_incident jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation record;
  v_incident_id uuid;
  v_category text;
  v_component text;
  v_environment text;
  v_error_code text;
  v_title text;
  v_description text;
  v_impact text;
  v_priority text;
  v_fingerprint text;
BEGIN
  IF p_failure_kind IS NULL OR p_failure_kind NOT IN ('transport', 'system')
     OR p_error IS NULL OR length(btrim(p_error)) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'invalid_external_task_failure' USING ERRCODE = '22023';
  END IF;

  SELECT g.id, g.origin, g.status, g.failure_kind, g.run_id, g.catalog_job_id,
         g.step_key, g.attempt, g.agent_role, g.operational_incident_id
  INTO v_generation
  FROM public.studio_generations g
  WHERE g.id = p_generation_id
  FOR UPDATE;
  IF NOT FOUND OR v_generation.origin <> 'external' THEN
    RAISE EXCEPTION 'external_generation_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_generation.status = 'failed' THEN
    v_incident_id := v_generation.operational_incident_id;
    RETURN jsonb_build_object(
      'generation_id', p_generation_id,
      'run_id', v_generation.run_id,
      'catalog_job_id', v_generation.catalog_job_id,
      'step_key', v_generation.step_key,
      'attempt', v_generation.attempt,
      'agent_role', v_generation.agent_role,
      'recorded', false,
      'already_reported', true,
      'status', v_generation.status,
      'failure_kind', v_generation.failure_kind,
      'incident_id', v_incident_id
    );
  END IF;
  IF v_generation.status = 'completed' THEN
    RETURN jsonb_build_object(
      'generation_id', p_generation_id,
      'run_id', v_generation.run_id,
      'catalog_job_id', v_generation.catalog_job_id,
      'step_key', v_generation.step_key,
      'attempt', v_generation.attempt,
      'agent_role', v_generation.agent_role,
      'recorded', false,
      'already_reported', true,
      'status', v_generation.status,
      'failure_kind', v_generation.failure_kind,
      'incident_id', v_generation.operational_incident_id
    );
  END IF;
  IF v_generation.status <> 'submitting' THEN
    RAISE EXCEPTION 'generation_not_waiting_for_output' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_generations
  SET status = 'failed',
      failure_kind = p_failure_kind,
      error = left(btrim(p_error), 2000),
      completed_at = now()
  WHERE id = p_generation_id;

  IF p_incident IS NOT NULL THEN
    IF jsonb_typeof(p_incident) <> 'object' THEN
      RAISE EXCEPTION 'invalid_operational_incident' USING ERRCODE = '22023';
    END IF;
    v_category := p_incident ->> 'category';
    v_component := p_incident ->> 'component';
    v_environment := coalesce(nullif(p_incident ->> 'environment', ''), 'unknown');
    v_error_code := p_incident ->> 'error_code';
    v_title := p_incident ->> 'title';
    v_description := p_incident ->> 'description';
    v_impact := coalesce(p_incident ->> 'impact', '');
    v_priority := nullif(p_incident ->> 'priority', '');

    IF v_category IS NULL OR v_category NOT IN ('mcp', 'runtime', 'configuration', 'dependency', 'database', 'contract', 'external_service', 'unknown')
       OR v_component IS NULL OR v_component !~ '^[a-z0-9][a-z0-9._-]{0,119}$'
       OR v_environment IS NULL OR v_environment NOT IN ('local', 'staging', 'production', 'unknown')
       OR v_error_code IS NULL OR v_error_code !~ '^[A-Z][A-Z0-9_]{0,79}$'
       OR v_title IS NULL OR length(btrim(v_title)) NOT BETWEEN 1 AND 200
       OR v_description IS NULL OR length(btrim(v_description)) NOT BETWEEN 1 AND 4000
       OR length(v_impact) > 2000
       OR (v_priority IS NOT NULL AND v_priority NOT IN ('P0', 'P1', 'P2', 'P3', 'P4', 'P5')) THEN
      RAISE EXCEPTION 'invalid_operational_incident' USING ERRCODE = '22023';
    END IF;

    v_fingerprint := concat_ws(':', v_category, v_component, v_environment, v_error_code);
    INSERT INTO public.studio_operational_incidents AS existing (
      fingerprint, error_code, category, component, environment,
      title, description, impact, priority, priority_source, status,
      reported_by, occurrence_count, first_seen_at, last_seen_at,
      last_run_id, last_catalog_job_id, last_generation_id, last_step_key, last_agent_role
    ) VALUES (
      v_fingerprint, v_error_code, v_category, v_component, v_environment,
      btrim(v_title), btrim(v_description), v_impact, v_priority, 'coordinator', 'open',
      'coordinator', 1, now(), now(),
      v_generation.run_id, v_generation.catalog_job_id, v_generation.id,
      v_generation.step_key, v_generation.agent_role
    )
    ON CONFLICT (fingerprint)
      WHERE status IN ('open', 'triaged', 'in_progress', 'blocked')
    DO UPDATE SET
      occurrence_count = CASE
        WHEN existing.last_generation_id IS NOT DISTINCT FROM EXCLUDED.last_generation_id
          THEN existing.occurrence_count
        ELSE existing.occurrence_count + 1
      END,
      last_seen_at = now(),
      last_run_id = EXCLUDED.last_run_id,
      last_catalog_job_id = EXCLUDED.last_catalog_job_id,
      last_generation_id = EXCLUDED.last_generation_id,
      last_step_key = EXCLUDED.last_step_key,
      last_agent_role = EXCLUDED.last_agent_role,
      priority = coalesce(existing.priority, EXCLUDED.priority),
      priority_source = CASE
        WHEN existing.priority IS NULL THEN EXCLUDED.priority_source
        ELSE existing.priority_source
      END
    RETURNING id INTO v_incident_id;

    UPDATE public.studio_generations
    SET operational_incident_id = v_incident_id
    WHERE id = p_generation_id;
  END IF;

  RETURN jsonb_build_object(
    'generation_id', p_generation_id,
    'run_id', v_generation.run_id,
    'catalog_job_id', v_generation.catalog_job_id,
    'step_key', v_generation.step_key,
    'attempt', v_generation.attempt,
    'agent_role', v_generation.agent_role,
    'recorded', true,
    'already_reported', false,
    'failure_kind', p_failure_kind,
    'retryable', p_failure_kind = 'transport',
    'incident_id', v_incident_id
  );
END;
$$;

CREATE FUNCTION public.studio_report_external_task_failure(
  p_generation_id uuid,
  p_failure_kind text,
  p_error text,
  p_incident jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_report_external_task_failure(p_generation_id, p_failure_kind, p_error, p_incident);
$$;

REVOKE ALL ON FUNCTION private.studio_report_external_task_failure(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.studio_report_external_task_failure(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION
  private.studio_report_external_task_failure(uuid, text, text, jsonb),
  public.studio_report_external_task_failure(uuid, text, text, jsonb)
TO service_role;
