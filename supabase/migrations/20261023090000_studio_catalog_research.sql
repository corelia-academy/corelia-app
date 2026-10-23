-- Corelia Studio: Catalog research (A1), scoring weights and rankings (roadmap 3.1, stage 1).
--
-- Model
--   studio_scoring_weights   versioned weights of the six criteria; the latest version is the one
--                            in use. Weights are config of the scoring step, not of the agent.
--   studio_catalog_jobs      one research of one course by A1 (manual, scheduled, after publish).
--                            At most one running job per course. Ends as
--                              evidence_ok          evidence enough to score
--                              needs_more_sources   research rounds used up; reason required
--                              failed               could not run (provider, budget); reason required
--   studio_generations       a row now belongs to exactly one owner: a step of a course run
--                            (run_id, step_key) or a catalog job (catalog_job_id). Catalog rows are
--                            A1 and only A1. The claim stays one UNIQUE: run rows keep
--                            (run, step, lesson, attempt); catalog rows are (job, attempt).
--   studio_catalog_rankings  one pass of the scoring step, with the weights and algorithm version it
--                            used. Two kinds, told apart by group_kind:
--                              group_kind = 'skill' | 'role' | 'ecosystem'
--                                  group rank: the course ranking inside one Type (Studio only).
--                              group_kind IS NULL
--                                  production order: the single global queue (exclusions, policy
--                                  tier, prerequisites, then score; a course in several Types gets
--                                  the MAX of its group totals).
--                            The latest pass of a kind is the one with the greatest computed_at.
--   studio_catalog_scores    one row per course and pass: component scores, total (0-100),
--                            confidence and rank. A course with paths in two Types has one row in
--                            each of the two group rankings (PK is (ranking_id, course_id)) and one
--                            row in the production order. A course left out has no rank and says
--                            why (e.g. no_path). The rank history of a course is its rows across
--                            passes. placement_reason / placement_for explain a production-order
--                            row that is not at its score position (prerequisite_of, manual).
--                            The queue is the latest production pass ordered by rank, not
--                            studio_courses.status (status = 'queued' means a run was queued).
--   studio_catalog_manual_orders
--                            admin reorder of the production queue: course, position, reason
--                            (required), actor and validity (active | superseded | expired).
--                            One active row per course.
--   studio_courses.policy_tier  'pilot' courses are placed before 'standard' ones in the production
--                            order; written by the admin UI.
--
-- Not enforced in the database, by design: that a course only has score rows in rankings of a Type
-- it has a path in. The check would be point-in-time only (a path removed later leaves valid history
-- behind), and the single writer of scores is the scoring step (stage 3), which builds each group
-- ranking from the course/path links it reads in the same pass. The same holds for placement_*
-- appearing only on production-order rows, and for the prerequisite check of a manual order: it
-- reuses the queue-building logic (stage 3), so the server runs it and then calls
-- studio_set_manual_order; the database only guarantees a valid, single active row per course.
--
-- research_status of a course is set only by studio_finish_catalog_job: the admin column grants on
-- studio_courses no longer include it, so the evidence_ok gate cannot be set from the browser.
-- The same function expires the active manual orders of the course when a research result lands.
--
-- Authorization: admin reads (studio_can_write()), service role writes, like studio_generations.

-- -----------------------------------------------------------------------------
-- 1) research_status is server-owned; policy_tier is admin-written
-- -----------------------------------------------------------------------------

ALTER TABLE public.studio_courses
  ADD COLUMN policy_tier text NOT NULL DEFAULT 'standard'
    CHECK (policy_tier IN ('pilot', 'standard'));

REVOKE INSERT, UPDATE ON public.studio_courses FROM authenticated;
GRANT INSERT (title, level, priority, status, policy_tier) ON public.studio_courses TO authenticated;
GRANT UPDATE (title, level, priority, status, policy_tier) ON public.studio_courses TO authenticated;

-- -----------------------------------------------------------------------------
-- 2) Scoring weights
-- -----------------------------------------------------------------------------

CREATE FUNCTION private.studio_valid_weights(p_weights jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN jsonb_typeof(p_weights) <> 'object' THEN false ELSE COALESCE(
    (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_weights) k)
      = ARRAY['ai_feasibility', 'catalog_gap', 'corelia_fit', 'demand', 'maintainability', 'trend']
    AND (SELECT bool_and(jsonb_typeof(v) = 'number' AND (v #>> '{}')::numeric BETWEEN 0 AND 1)
         FROM jsonb_each(p_weights) e (k, v))
    AND (SELECT sum((v #>> '{}')::numeric) FROM jsonb_each(p_weights) e (k, v)) = 1,
    false) END;
$$;

CREATE TABLE public.studio_scoring_weights (
  version integer PRIMARY KEY CHECK (version > 0),
  weights jsonb NOT NULL CHECK (private.studio_valid_weights(weights)),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.studio_scoring_weights (version, weights) VALUES (1, jsonb_build_object(
  'trend', 0.25, 'demand', 0.25, 'corelia_fit', 0.20,
  'catalog_gap', 0.15, 'ai_feasibility', 0.10, 'maintainability', 0.05));

-- -----------------------------------------------------------------------------
-- 3) Catalog research jobs
-- -----------------------------------------------------------------------------

CREATE TABLE public.studio_catalog_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.studio_courses (id) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN ('manual', 'scheduled', 'after_publish', 'rank_check_retry')),
  started_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'evidence_ok', 'needs_more_sources', 'failed')),
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_catalog_jobs_finished_matches_status
    CHECK ((status = 'running') = (finished_at IS NULL)),
  CONSTRAINT studio_catalog_jobs_reason_iff_not_ok
    CHECK ((status IN ('needs_more_sources', 'failed')) = (reason IS NOT NULL AND length(btrim(reason)) > 0))
);

CREATE UNIQUE INDEX studio_catalog_jobs_one_running_per_course
  ON public.studio_catalog_jobs (course_id) WHERE status = 'running';
CREATE INDEX studio_catalog_jobs_course_started_idx
  ON public.studio_catalog_jobs (course_id, started_at DESC);

CREATE TRIGGER trg_studio_catalog_jobs_touch_updated_at
  BEFORE UPDATE ON public.studio_catalog_jobs
  FOR EACH ROW EXECUTE FUNCTION private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 4) Generations owned by a run step or by a catalog job
-- -----------------------------------------------------------------------------

ALTER TABLE public.studio_generations
  ADD COLUMN catalog_job_id uuid REFERENCES public.studio_catalog_jobs (id) ON DELETE CASCADE,
  ALTER COLUMN run_id DROP NOT NULL,
  ALTER COLUMN step_key DROP NOT NULL;

ALTER TABLE public.studio_generations
  ADD CONSTRAINT studio_generations_one_owner CHECK (
    (run_id IS NOT NULL AND step_key IS NOT NULL AND catalog_job_id IS NULL)
    OR (catalog_job_id IS NOT NULL AND run_id IS NULL AND step_key IS NULL AND lesson_id IS NULL)),
  ADD CONSTRAINT studio_generations_catalog_is_a1 CHECK ((catalog_job_id IS NOT NULL) = (agent_role = 'A1'));

-- Run rows have catalog_job_id NULL, so their claim is unchanged; catalog rows differ by job.
ALTER TABLE public.studio_generations DROP CONSTRAINT studio_generations_attempt_key;
ALTER TABLE public.studio_generations
  ADD CONSTRAINT studio_generations_attempt_key
  UNIQUE NULLS NOT DISTINCT (run_id, step_key, lesson_id, catalog_job_id, attempt);

CREATE INDEX studio_generations_catalog_job_idx
  ON public.studio_generations (catalog_job_id) WHERE catalog_job_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5) Rankings and scores
-- -----------------------------------------------------------------------------

CREATE TABLE public.studio_catalog_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = production order (the global queue); otherwise the group rank of that Type.
  group_kind text CHECK (group_kind IN ('skill', 'role', 'ecosystem')),
  weights_version integer NOT NULL REFERENCES public.studio_scoring_weights (version),
  algorithm_version text NOT NULL CHECK (length(btrim(algorithm_version)) > 0),
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- Latest pass per Type, and latest production pass (group_kind IS NULL).
CREATE INDEX studio_catalog_rankings_group_computed_idx
  ON public.studio_catalog_rankings (group_kind, computed_at DESC) WHERE group_kind IS NOT NULL;
CREATE INDEX studio_catalog_rankings_production_computed_idx
  ON public.studio_catalog_rankings (computed_at DESC) WHERE group_kind IS NULL;

CREATE TABLE public.studio_catalog_scores (
  ranking_id uuid NOT NULL REFERENCES public.studio_catalog_rankings (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.studio_courses (id) ON DELETE CASCADE,
  -- Research the score was computed from; NULL when the course has never been researched.
  job_id uuid REFERENCES public.studio_catalog_jobs (id) ON DELETE CASCADE,
  -- Per criterion: level, weight used, confidence, or missing.
  components jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(components) = 'object'),
  total numeric(5, 2) CHECK (total BETWEEN 0 AND 100),
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  rank integer CHECK (rank > 0),
  excluded_reason text,
  -- Production order only: why the row is not at its score position. prerequisite_of: pulled up to
  -- stand right before placement_for (the course that depends on it); manual: placed by an admin.
  placement_reason text CHECK (placement_reason IN ('prerequisite_of', 'manual')),
  placement_for uuid REFERENCES public.studio_courses (id) ON DELETE CASCADE,
  PRIMARY KEY (ranking_id, course_id),
  CONSTRAINT studio_catalog_scores_rank_key UNIQUE (ranking_id, rank),
  CONSTRAINT studio_catalog_scores_ranked_has_score
    CHECK (rank IS NULL OR (total IS NOT NULL AND confidence IS NOT NULL AND job_id IS NOT NULL)),
  CONSTRAINT studio_catalog_scores_excluded_iff_unranked
    CHECK ((rank IS NULL) = (excluded_reason IS NOT NULL AND length(btrim(excluded_reason)) > 0)),
  CONSTRAINT studio_catalog_scores_placement_only_when_ranked
    CHECK (placement_reason IS NULL OR rank IS NOT NULL),
  CONSTRAINT studio_catalog_scores_placement_for_iff_prerequisite
    CHECK ((placement_reason = 'prerequisite_of') = (placement_for IS NOT NULL))
);

CREATE INDEX studio_catalog_scores_course_idx ON public.studio_catalog_scores (course_id);

-- Admin reorder of the production queue. A row is a record, not a toggle: it is superseded by the
-- next order for the same course and expires when the course gets a new research result.
CREATE TABLE public.studio_catalog_manual_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.studio_courses (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'expired')),
  ended_at timestamptz,
  CONSTRAINT studio_catalog_manual_orders_ended_matches_status
    CHECK ((status = 'active') = (ended_at IS NULL))
);

CREATE UNIQUE INDEX studio_catalog_manual_orders_one_active_per_course
  ON public.studio_catalog_manual_orders (course_id) WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- 6) RLS: admin read, service role write
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'studio_scoring_weights', 'studio_catalog_jobs', 'studio_catalog_rankings', 'studio_catalog_scores',
    'studio_catalog_manual_orders'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.studio_can_write()))',
      t || '_admin_read', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 7) Job lifecycle (service role only)
-- -----------------------------------------------------------------------------

-- Creates a running job. Repeating the same job id for the same course returns it unchanged; a
-- second running job of the course fails on studio_catalog_jobs_one_running_per_course (23505).
CREATE FUNCTION private.studio_start_catalog_job(p_course_id uuid, p_job_id uuid, p_trigger text, p_started_by uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_course uuid;
BEGIN
  PERFORM 1 FROM public.studio_courses c WHERE c.id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT j.course_id INTO v_existing_course FROM public.studio_catalog_jobs j WHERE j.id = p_job_id;
  IF FOUND THEN
    IF v_existing_course <> p_course_id THEN
      RAISE EXCEPTION 'job_id_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('job_id', p_job_id, 'created', false);
  END IF;

  INSERT INTO public.studio_catalog_jobs (id, course_id, trigger, started_by)
  VALUES (p_job_id, p_course_id, p_trigger, p_started_by);
  RETURN jsonb_build_object('job_id', p_job_id, 'created', true);
END;
$$;

-- Ends a running job. evidence_ok and needs_more_sources become the course research_status; a
-- failed job leaves it as it was. A new research result also expires the active manual orders of the
-- course: they were set against the previous evidence. Returns false when the job had already ended.
CREATE FUNCTION private.studio_finish_catalog_job(p_job_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_course uuid;
BEGIN
  IF p_status NOT IN ('evidence_ok', 'needs_more_sources', 'failed') THEN
    RAISE EXCEPTION 'invalid_job_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.studio_catalog_jobs
  SET status = p_status,
      finished_at = now(),
      reason = CASE WHEN p_status <> 'evidence_ok' THEN left(p_reason, 1000) END
  WHERE id = p_job_id AND status = 'running'
  RETURNING course_id INTO v_course;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_status <> 'failed' THEN
    UPDATE public.studio_courses SET research_status = p_status WHERE id = v_course;
    UPDATE public.studio_catalog_manual_orders
    SET status = 'expired', ended_at = now()
    WHERE course_id = v_course AND status = 'active';
  END IF;
  RETURN true;
END;
$$;

-- Saves a manual order of the production queue: the previous active order of the course is superseded
-- and the new one becomes active, in one transaction. The prerequisite check runs before this call
-- (it is the queue-building logic of stage 3); this function does not repeat it.
CREATE FUNCTION private.studio_set_manual_order(p_course_id uuid, p_position integer, p_reason text, p_actor uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM 1 FROM public.studio_courses c WHERE c.id = p_course_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.studio_catalog_manual_orders
  SET status = 'superseded', ended_at = now()
  WHERE course_id = p_course_id AND status = 'active';

  INSERT INTO public.studio_catalog_manual_orders (course_id, position, reason, created_by)
  VALUES (p_course_id, p_position, p_reason, p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.studio_set_manual_order(p_course_id uuid, p_position integer, p_reason text, p_actor uuid)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_set_manual_order(p_course_id, p_position, p_reason, p_actor);
$$;

CREATE FUNCTION public.studio_start_catalog_job(p_course_id uuid, p_job_id uuid, p_trigger text, p_started_by uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_start_catalog_job(p_course_id, p_job_id, p_trigger, p_started_by);
$$;

CREATE FUNCTION public.studio_finish_catalog_job(p_job_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.studio_finish_catalog_job(p_job_id, p_status, p_reason);
$$;

REVOKE ALL ON FUNCTION
  private.studio_start_catalog_job(uuid, uuid, text, uuid),
  private.studio_finish_catalog_job(uuid, text, text),
  private.studio_set_manual_order(uuid, integer, text, uuid),
  public.studio_start_catalog_job(uuid, uuid, text, uuid),
  public.studio_finish_catalog_job(uuid, text, text),
  public.studio_set_manual_order(uuid, integer, text, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  private.studio_start_catalog_job(uuid, uuid, text, uuid),
  private.studio_finish_catalog_job(uuid, text, text),
  private.studio_set_manual_order(uuid, integer, text, uuid),
  public.studio_start_catalog_job(uuid, uuid, text, uuid),
  public.studio_finish_catalog_job(uuid, text, text),
  public.studio_set_manual_order(uuid, integer, text, uuid)
TO service_role;
