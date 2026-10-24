-- Hybrid project moderation.
-- * Results are cached per text hash, so unchanged text is never sent to the
--   provider twice, whichever project or locale it appears in.
-- * Publishing still moderates synchronously (Edge). Edits to an already
--   published project, and private drafts, are queued and checked in batches
--   by a background worker that hides a published project if text is flagged.
-- * Signed-in users can report a project; reports raise its queue priority and
--   land in the staff review list.

-- Text hash shared by SQL and the Edge (sha256 hex of the trimmed UTF-8 text).
CREATE OR REPLACE FUNCTION private.moderation_text_hash(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(btrim(p_text),'UTF8')),'hex')
$$;
REVOKE ALL ON FUNCTION private.moderation_text_hash(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.moderation_text_hash(text) TO service_role;

CREATE TABLE IF NOT EXISTS private.moderation_results (
  content_hash text PRIMARY KEY,
  flagged boolean NOT NULL,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.moderation_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.moderation_results FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.moderation_results TO service_role;

-- Flagged text a staff member reviewed and allowed for one project.
CREATE TABLE IF NOT EXISTS private.project_moderation_allowlist (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  allowed_by uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (project_id, content_hash)
);
ALTER TABLE private.project_moderation_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_moderation_allowlist FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON private.project_moderation_allowlist TO service_role;

CREATE TABLE IF NOT EXISTS private.project_moderation_queue (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 0,
  run_after timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS project_moderation_queue_due
  ON private.project_moderation_queue(priority DESC, run_after) WHERE attempts < 5;
ALTER TABLE private.project_moderation_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_moderation_queue FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.project_moderation_queue TO service_role;

-- System (AI) moderation actions have no human actor.
ALTER TABLE private.project_moderation_audit ALTER COLUMN actor_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','sexual','violence','hate','illegal','plagiarism','other')),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  resolved_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS project_reports_one_open_per_reporter
  ON public.project_reports(project_id, reporter_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS project_reports_project_status
  ON public.project_reports(project_id, status);
CREATE INDEX IF NOT EXISTS project_reports_reporter_time
  ON public.project_reports(reporter_id, created_at DESC);
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_reports FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_reports TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_reports TO service_role;
DROP POLICY IF EXISTS project_reports_select_own_or_staff ON public.project_reports;
CREATE POLICY project_reports_select_own_or_staff ON public.project_reports FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR (SELECT private.is_admin_or_support()));

CREATE OR REPLACE FUNCTION private.enqueue_project_moderation(p_project_id uuid, p_priority integer, p_delay_seconds integer)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  INSERT INTO private.project_moderation_queue AS q (project_id,priority,run_after)
  VALUES (p_project_id, p_priority, clock_timestamp() + pg_catalog.make_interval(secs => GREATEST(p_delay_seconds,0)))
  ON CONFLICT (project_id) DO UPDATE SET
    priority = GREATEST(q.priority, EXCLUDED.priority),
    -- A report must not wait behind an edit debounce; edits do not delay a report.
    run_after = LEAST(q.run_after, EXCLUDED.run_after),
    attempts = 0, last_error = NULL, updated_at = clock_timestamp()
$$;
REVOKE ALL ON FUNCTION private.enqueue_project_moderation(uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.enqueue_project_moderation(uuid,integer,integer) TO service_role;

-- Edge: queue a project after a save that skipped synchronous moderation.
CREATE OR REPLACE FUNCTION public.enqueue_project_moderation(p_project_id uuid, p_delay_seconds integer DEFAULT 60)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT private.enqueue_project_moderation(p_project_id, 0, p_delay_seconds)
$$;

-- Edge (sync path): cached verdicts for text hashes, honoring the project allowlist.
CREATE OR REPLACE FUNCTION public.project_moderation_verdicts(p_project_id uuid, p_hashes text[])
RETURNS TABLE(content_hash text, flagged boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT r.content_hash,
    r.flagged AND NOT EXISTS (
      SELECT 1 FROM private.project_moderation_allowlist a
      WHERE a.project_id = p_project_id AND a.content_hash = r.content_hash)
  FROM private.moderation_results r
  WHERE r.content_hash = ANY(p_hashes)
$$;

-- Edge: store provider verdicts. p_results: [{hash, flagged, categories}]
CREATE OR REPLACE FUNCTION public.record_moderation_results(p_results jsonb, p_model text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  INSERT INTO private.moderation_results(content_hash,flagged,categories,model,checked_at)
  SELECT item->>'hash', (item->>'flagged')::boolean, COALESCE(item->'categories','[]'::jsonb), p_model, clock_timestamp()
  FROM jsonb_array_elements(COALESCE(p_results,'[]'::jsonb)) item
  WHERE item->>'hash' ~ '^[0-9a-f]{64}$' AND jsonb_typeof(item->'flagged') = 'boolean'
  ON CONFLICT (content_hash) DO UPDATE SET
    flagged = EXCLUDED.flagged, categories = EXCLUDED.categories, model = EXCLUDED.model, checked_at = EXCLUDED.checked_at
$$;

-- Worker: lease due projects and return every non-empty text with its hash and
-- cached verdict (NULL when the text has never been checked).
CREATE OR REPLACE FUNCTION public.claim_project_moderation(p_limit integer DEFAULT 10)
RETURNS TABLE(project_id uuid, field text, content_hash text, text_value text, flagged boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_now timestamptz := clock_timestamp(); v_ids uuid[];
BEGIN
  WITH picked AS (
    SELECT q.project_id FROM private.project_moderation_queue q
    WHERE q.run_after <= v_now AND q.attempts < 5 AND (q.locked_until IS NULL OR q.locked_until < v_now)
    ORDER BY q.priority DESC, q.run_after
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit,10), 50))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE private.project_moderation_queue q
    SET locked_until = v_now + interval '5 minutes', attempts = q.attempts + 1, updated_at = v_now
    FROM picked WHERE q.project_id = picked.project_id
    RETURNING q.project_id
  )
  SELECT array_agg(c.project_id) INTO v_ids FROM claimed c;

  RETURN QUERY
  WITH texts AS (
    SELECT p.id AS project_id, f.field, f.value
    FROM public.projects p
    CROSS JOIN LATERAL (VALUES ('title',p.title),('summary',p.summary),('description',p.description),('progress',p.progress)) f(field,value)
    WHERE p.id = ANY(v_ids)
    UNION ALL
    SELECT pl.project_id, pl.locale || '.' || kv.key, kv.value
    FROM public.project_locales pl
    CROSS JOIN LATERAL jsonb_each_text(pl.data) kv
    WHERE pl.project_id = ANY(v_ids) AND kv.key IN ('title','summary','description','progress')
  ), hashed AS (
    SELECT t.project_id, t.field, private.moderation_text_hash(t.value) AS content_hash, btrim(t.value) AS text_value
    FROM texts t WHERE t.value IS NOT NULL AND btrim(t.value) <> ''
  )
  SELECT h.project_id, h.field, h.content_hash,
    CASE WHEN r.content_hash IS NULL THEN h.text_value END,
    CASE WHEN r.content_hash IS NULL THEN NULL
      ELSE r.flagged AND NOT EXISTS (
        SELECT 1 FROM private.project_moderation_allowlist a
        WHERE a.project_id = h.project_id AND a.content_hash = h.content_hash) END
  FROM hashed h LEFT JOIN private.moderation_results r ON r.content_hash = h.content_hash
  UNION ALL
  -- Projects with no text still need to leave the queue.
  SELECT id, NULL, NULL, NULL, NULL FROM unnest(v_ids) id;
END;
$$;

-- Worker: finish a project. Hides a published project when text is flagged.
CREATE OR REPLACE FUNCTION public.finish_project_moderation(p_project_id uuid, p_flagged_fields text[])
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_project public.projects%ROWTYPE;
BEGIN
  DELETE FROM private.project_moderation_queue WHERE project_id = p_project_id;
  IF COALESCE(cardinality(p_flagged_fields),0) = 0 THEN RETURN false; END IF;
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_project.blocked OR v_project.visibility = 'private' THEN RETURN false; END IF;
  INSERT INTO private.project_moderation_audit(project_id,actor_id,action,reason,snapshot)
  VALUES (p_project_id, NULL, 'block',
    'automatic: flagged ' || array_to_string(p_flagged_fields, ', '),
    jsonb_build_object('project', to_jsonb(v_project)));
  UPDATE public.projects SET blocked = true, visibility = 'private' WHERE id = p_project_id;
  UPDATE public.project_reports SET status = 'actioned', resolved_at = clock_timestamp()
  WHERE project_id = p_project_id AND status = 'open';
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_project_moderation(p_project_id uuid, p_error text)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  UPDATE private.project_moderation_queue
  SET locked_until = NULL, last_error = left(p_error,200),
    run_after = clock_timestamp() + pg_catalog.make_interval(secs => 120 * attempts), updated_at = clock_timestamp()
  WHERE project_id = p_project_id
$$;

-- Edge, after a staff unblock: current flagged text is reviewed and allowed.
CREATE OR REPLACE FUNCTION public.allow_project_moderation_overrides(p_actor_id uuid, p_project_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  INSERT INTO private.project_moderation_allowlist(project_id,content_hash,allowed_by)
  SELECT p_project_id, r.content_hash, p_actor_id
  FROM (
    SELECT private.moderation_text_hash(v) AS h FROM public.projects p
    CROSS JOIN LATERAL (VALUES (p.title),(p.summary),(p.description),(p.progress)) f(v)
    WHERE p.id = p_project_id AND v IS NOT NULL AND btrim(v) <> ''
    UNION
    SELECT private.moderation_text_hash(kv.value) FROM public.project_locales pl
    CROSS JOIN LATERAL jsonb_each_text(pl.data) kv
    WHERE pl.project_id = p_project_id AND kv.key IN ('title','summary','description','progress') AND btrim(kv.value) <> ''
  ) t JOIN private.moderation_results r ON r.content_hash = t.h AND r.flagged
  ON CONFLICT DO NOTHING
$$;

-- Browser: report a visible project. 20 reports per reporter per day.
CREATE OR REPLACE FUNCTION public.report_project(p_project_id uuid, p_reason text, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_reporters bigint;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501'; END IF;
  SELECT owner_id INTO v_owner FROM public.projects
  WHERE id = p_project_id AND NOT blocked AND visibility IN ('public','unlisted');
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF v_owner = v_actor THEN RAISE EXCEPTION 'invalid_input:project_report_self'; END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('spam','harassment','sexual','violence','hate','illegal','plagiarism','other')
    OR char_length(COALESCE(p_note,'')) > 500 THEN
    RAISE EXCEPTION 'invalid_input:project_report';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('project-report:' || v_actor::text, 0));
  IF (SELECT count(*) FROM public.project_reports
      WHERE reporter_id = v_actor AND created_at > clock_timestamp() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'rate_limited:project_report';
  END IF;
  INSERT INTO public.project_reports(project_id,reporter_id,reason,note)
  VALUES (p_project_id, v_actor, p_reason, NULLIF(btrim(p_note),''))
  ON CONFLICT (project_id, reporter_id) WHERE status = 'open' DO NOTHING;

  SELECT count(*) INTO v_reporters FROM public.project_reports WHERE project_id = p_project_id AND status = 'open';
  PERFORM private.enqueue_project_moderation(p_project_id, LEAST(v_reporters, 10)::integer, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.report_project(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.report_project(uuid,text,text) TO authenticated;

-- Staff: projects with open reports, most-reported first.
CREATE OR REPLACE FUNCTION public.list_reported_projects(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(
  project_id uuid, slug text, title text, visibility text, blocked boolean, owner_id uuid,
  source_id text, source_type text, open_reports bigint, reasons text[], latest_report_at timestamptz, notes text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF NOT private.is_admin_or_support() THEN RAISE EXCEPTION 'forbidden:project_reports' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT p.id, p.slug, p.title, p.visibility, p.blocked, p.owner_id, p.source_id, p.source_type,
    count(*), array_agg(DISTINCT r.reason), max(r.created_at),
    (array_agg(r.note ORDER BY r.created_at DESC) FILTER (WHERE r.note IS NOT NULL))[1:5]
  FROM public.project_reports r JOIN public.projects p ON p.id = r.project_id
  WHERE r.status = 'open'
  GROUP BY p.id
  ORDER BY count(*) DESC, max(r.created_at) DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit,20), 100)) OFFSET GREATEST(COALESCE(p_offset,0),0);
END;
$$;
REVOKE ALL ON FUNCTION public.list_reported_projects(integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_reported_projects(integer,integer) TO authenticated;

-- Staff: close all open reports on a project.
CREATE OR REPLACE FUNCTION public.resolve_project_reports(p_project_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin_or_support() THEN RAISE EXCEPTION 'forbidden:project_reports' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('dismissed','actioned') THEN RAISE EXCEPTION 'invalid_input:project_report_status'; END IF;
  UPDATE public.project_reports SET status = p_status, resolved_at = clock_timestamp(), resolved_by = auth.uid()
  WHERE project_id = p_project_id AND status = 'open';
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_project_reports(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_project_reports(uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.enqueue_project_moderation(uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.project_moderation_verdicts(uuid,text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_moderation_results(jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_project_moderation(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_project_moderation(uuid,text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_project_moderation(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.allow_project_moderation_overrides(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_project_moderation(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_moderation_verdicts(uuid,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_moderation_results(jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_project_moderation(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_project_moderation(uuid,text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_project_moderation(uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.allow_project_moderation_overrides(uuid,uuid) TO service_role;

SELECT cron.schedule(
  'corelia-project-moderation',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'corelia_jobs_project_url'
      ) || '/functions/v1/corelia-api?op=projects.moderation.run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-corelia-jobs-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'corelia_jobs_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
    WHERE EXISTS (
      SELECT 1 FROM private.project_moderation_queue
      WHERE run_after <= now() AND attempts < 5 AND (locked_until IS NULL OR locked_until < now())
    );
  $job$
);
