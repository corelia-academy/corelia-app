-- Project translations follow the primary locale through a background queue.
-- Owners edit the primary language; every other enabled locale is re-translated
-- once the primary content has stopped changing for a few minutes. A locale the
-- owner edits by hand becomes 'manual' and is never overwritten until the owner
-- asks for a fresh translation.

ALTER TABLE public.project_locales
  ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS translated_at timestamptz;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.project_locales'::regclass
      AND conname = 'project_locales_translation_status_check'
  ) THEN
    ALTER TABLE public.project_locales
      ADD CONSTRAINT project_locales_translation_status_check
      CHECK (translation_status IN ('source','fresh','stale','pending','failed','manual'));
  END IF;
END;
$constraint$;

-- Existing translations may be hand-written, so they start as 'manual' and are
-- only replaced when the owner requests it. Primary rows are the source.
UPDATE public.project_locales pl
SET translation_status = 'source'
FROM public.projects p
WHERE p.id = pl.project_id
  AND pl.locale = COALESCE(p.i18n->>'primary_content_locale','vi');

CREATE TABLE IF NOT EXISTS private.project_translation_jobs (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  target_locale text NOT NULL,
  source_hash text NOT NULL,
  run_after timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (project_id, target_locale)
);
CREATE INDEX IF NOT EXISTS project_translation_jobs_due
  ON private.project_translation_jobs(run_after) WHERE attempts < 3;
ALTER TABLE private.project_translation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.project_translation_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.project_translation_jobs TO service_role;

CREATE OR REPLACE FUNCTION private.project_source_hash(p_project_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object(
    'title',COALESCE(p.title,''),'summary',COALESCE(p.summary,''),
    'description',COALESCE(p.description,''),'progress',COALESCE(p.progress,'')
  )::text,'UTF8')),'hex')
  FROM public.projects p WHERE p.id = p_project_id
$$;
REVOKE ALL ON FUNCTION private.project_source_hash(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.project_source_hash(uuid) TO service_role;

-- Called by the Edge save handler after a successful project save.
-- p_manual_locales: non-primary locales whose text the owner changed in this save.
CREATE OR REPLACE FUNCTION public.sync_project_translations(
  p_project_id uuid,
  p_manual_locales text[] DEFAULT '{}'::text[],
  p_debounce_seconds integer DEFAULT 300
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_primary text;
  v_hash text;
  v_targets text[];
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT COALESCE(i18n->>'primary_content_locale','vi') INTO v_primary
  FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  v_hash := private.project_source_hash(p_project_id);

  UPDATE public.project_locales SET translation_status='source', source_hash=v_hash, translated_at=NULL
  WHERE project_id=p_project_id AND locale=v_primary;
  DELETE FROM private.project_translation_jobs WHERE project_id=p_project_id AND target_locale=v_primary;

  -- Hand edits, and a former primary after a primary switch, are owner-authored.
  UPDATE public.project_locales SET translation_status='manual', source_hash=v_hash, translated_at=NULL
  WHERE project_id=p_project_id AND locale<>v_primary
    AND (locale = ANY(COALESCE(p_manual_locales,'{}'::text[])) OR translation_status='source');
  DELETE FROM private.project_translation_jobs
  WHERE project_id=p_project_id AND target_locale = ANY(COALESCE(p_manual_locales,'{}'::text[]));

  -- Targets: enabled locales plus locales that already have content.
  SELECT COALESCE(array_agg(DISTINCT l),'{}') INTO v_targets FROM (
    SELECT jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p.i18n->'supported_locales')='array' THEN p.i18n->'supported_locales' ELSE '[]'::jsonb END
    ) AS l FROM public.projects p WHERE p.id=p_project_id
    UNION SELECT locale FROM public.project_locales WHERE project_id=p_project_id
  ) s
  WHERE l <> v_primary AND l = ANY(private.supported_content_locales())
    AND NOT EXISTS (
      SELECT 1 FROM public.project_locales pl
      WHERE pl.project_id=p_project_id AND pl.locale=s.l
        AND (pl.translation_status='manual' OR pl.source_hash IS NOT DISTINCT FROM v_hash)
    );

  UPDATE public.project_locales SET translation_status='stale'
  WHERE project_id=p_project_id AND locale = ANY(v_targets);

  -- Upserting pushes run_after back on every save, so a burst of edits
  -- produces one translation per locale after the owner stops typing.
  INSERT INTO private.project_translation_jobs(project_id,target_locale,source_hash,run_after)
  SELECT p_project_id, t, v_hash, v_now + pg_catalog.make_interval(secs => GREATEST(p_debounce_seconds,0))
  FROM unnest(v_targets) t
  ON CONFLICT (project_id,target_locale) DO UPDATE SET
    source_hash=EXCLUDED.source_hash, run_after=EXCLUDED.run_after,
    attempts=0, last_error=NULL, updated_at=v_now;
END;
$$;

-- Owner asks for a locale to be (re)translated now. Overrides 'manual'.
CREATE OR REPLACE FUNCTION public.request_project_translation(p_actor_id uuid, p_project_id uuid, p_locale text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_primary text;
  v_blocked boolean;
  v_now timestamptz := clock_timestamp();
BEGIN
  PERFORM private.assert_project_content_editable(p_actor_id,p_project_id);
  SELECT COALESCE(i18n->>'primary_content_locale','vi'), blocked INTO v_primary, v_blocked
  FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found:project'; END IF;
  IF v_blocked THEN RAISE EXCEPTION 'forbidden:project_blocked'; END IF;
  IF p_locale IS NULL OR NOT p_locale = ANY(private.supported_content_locales()) OR p_locale = v_primary THEN
    RAISE EXCEPTION 'invalid_input:project_locale';
  END IF;

  UPDATE public.projects
  SET i18n = COALESCE(i18n,'{}'::jsonb) || jsonb_build_object('supported_locales',
    private.project_supported_locales(COALESCE(i18n,'{}'::jsonb) || jsonb_build_object('supported_locales',
      COALESCE(i18n->'supported_locales','[]'::jsonb) || to_jsonb(p_locale)), v_primary))
  WHERE id=p_project_id;
  UPDATE public.project_locales SET translation_status='pending'
  WHERE project_id=p_project_id AND locale=p_locale;

  INSERT INTO private.project_translation_jobs(project_id,target_locale,source_hash,run_after)
  VALUES (p_project_id,p_locale,private.project_source_hash(p_project_id),v_now)
  ON CONFLICT (project_id,target_locale) DO UPDATE SET
    source_hash=EXCLUDED.source_hash, run_after=v_now, attempts=0,
    locked_until=NULL, last_error=NULL, updated_at=v_now;
END;
$$;

-- Owner-facing status: one row per non-primary locale with content or a job.
CREATE OR REPLACE FUNCTION public.project_translation_status(p_actor_id uuid, p_project_id uuid)
RETURNS TABLE(locale text, status text, translated_at timestamptz, last_error text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_primary text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id=p_project_id AND (p.owner_id=p_actor_id OR EXISTS (
      SELECT 1 FROM public.profiles pr WHERE pr.id=p_actor_id AND pr.role IN ('admin','support_staff')))
  ) THEN
    RAISE EXCEPTION 'forbidden:project_update';
  END IF;
  SELECT COALESCE(i18n->>'primary_content_locale','vi') INTO v_primary FROM public.projects WHERE id=p_project_id;
  RETURN QUERY
  SELECT COALESCE(pl.locale,j.target_locale),
    CASE
      WHEN j.target_locale IS NULL THEN pl.translation_status
      WHEN j.attempts >= 3 THEN 'failed'
      WHEN j.locked_until > clock_timestamp() OR pl.locale IS NULL OR pl.translation_status = 'pending' THEN 'pending'
      ELSE 'stale'
    END,
    pl.translated_at,
    j.last_error
  FROM (SELECT * FROM public.project_locales WHERE project_id=p_project_id AND project_locales.locale<>v_primary) pl
  FULL JOIN (SELECT * FROM private.project_translation_jobs WHERE project_id=p_project_id) j
    ON j.target_locale=pl.locale
  ORDER BY 1;
END;
$$;

-- Worker: claim due jobs with a lease so concurrent runs never translate twice.
CREATE OR REPLACE FUNCTION public.claim_project_translation_jobs(p_limit integer DEFAULT 5)
RETURNS TABLE(
  project_id uuid, target_locale text, source_hash text, attempts integer,
  owner_id uuid, primary_locale text, title text, summary text, description text, progress text
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_now timestamptz := clock_timestamp();
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.project_id, j.target_locale
    FROM private.project_translation_jobs j
    WHERE j.run_after <= v_now AND j.attempts < 3
      AND (j.locked_until IS NULL OR j.locked_until < v_now)
    ORDER BY j.run_after
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit,5), 20))
    FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE private.project_translation_jobs j
    SET locked_until = v_now + interval '5 minutes', attempts = j.attempts + 1, updated_at = v_now
    FROM picked
    WHERE j.project_id = picked.project_id AND j.target_locale = picked.target_locale
    RETURNING j.project_id, j.target_locale, j.source_hash, j.attempts
  )
  SELECT c.project_id, c.target_locale, c.source_hash, c.attempts, p.owner_id,
    COALESCE(p.i18n->>'primary_content_locale','vi'),
    COALESCE(p.title,''), COALESCE(p.summary,''), COALESCE(p.description,''), COALESCE(p.progress,'')
  FROM claimed c JOIN public.projects p ON p.id = c.project_id;
END;
$$;

-- Worker: store a finished translation if it still matches the current source.
-- Returns false when the job was superseded (the newer job will run instead).
CREATE OR REPLACE FUNCTION public.complete_project_translation_job(
  p_project_id uuid, p_locale text, p_source_hash text, p_data jsonb
)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_job_hash text;
  v_primary text;
  v_blocked boolean;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT COALESCE(i18n->>'primary_content_locale','vi'), blocked INTO v_primary, v_blocked
  FROM public.projects WHERE id=p_project_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT source_hash INTO v_job_hash FROM private.project_translation_jobs
  WHERE project_id=p_project_id AND target_locale=p_locale FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_job_hash IS DISTINCT FROM p_source_hash THEN
    -- Superseded by a newer save: release the lease without spending an attempt.
    UPDATE private.project_translation_jobs
    SET locked_until=NULL, attempts=GREATEST(attempts-1,0), updated_at=v_now
    WHERE project_id=p_project_id AND target_locale=p_locale;
    RETURN false;
  END IF;
  IF v_blocked OR p_locale = v_primary
    OR private.project_source_hash(p_project_id) IS DISTINCT FROM p_source_hash THEN
    DELETE FROM private.project_translation_jobs WHERE project_id=p_project_id AND target_locale=p_locale;
    RETURN false;
  END IF;
  IF jsonb_typeof(p_data) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_each(p_data) WHERE key NOT IN ('title','summary','description','progress') OR jsonb_typeof(value) <> 'string')
    OR char_length(p_data->>'title') > 160 OR char_length(p_data->>'summary') > 1000
    OR char_length(p_data->>'description') > 20000 OR char_length(p_data->>'progress') > 10000 THEN
    RAISE EXCEPTION 'invalid_input:project_content';
  END IF;

  INSERT INTO public.project_locales(project_id,locale,data,translation_status,source_hash,translated_at,updated_at)
  VALUES (p_project_id,p_locale,p_data || jsonb_build_object('updated_at',v_now),'fresh',p_source_hash,v_now,v_now)
  ON CONFLICT ON CONSTRAINT project_locales_pkey DO UPDATE SET
    data=EXCLUDED.data, translation_status='fresh', source_hash=EXCLUDED.source_hash,
    translated_at=EXCLUDED.translated_at, updated_at=EXCLUDED.updated_at;
  DELETE FROM private.project_translation_jobs WHERE project_id=p_project_id AND target_locale=p_locale;
  RETURN true;
END;
$$;

-- Worker: release a lease after a failure. p_count_attempt=false for budget
-- throttling, which is not the job's fault.
CREATE OR REPLACE FUNCTION public.fail_project_translation_job(
  p_project_id uuid, p_locale text, p_error text, p_retry_seconds integer, p_count_attempt boolean DEFAULT true
)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_now timestamptz := clock_timestamp(); v_attempts integer;
BEGIN
  UPDATE private.project_translation_jobs
  SET locked_until=NULL,
    attempts=CASE WHEN p_count_attempt THEN attempts ELSE GREATEST(attempts-1,0) END,
    run_after=v_now + pg_catalog.make_interval(secs => GREATEST(p_retry_seconds,0)),
    last_error=left(p_error,200), updated_at=v_now
  WHERE project_id=p_project_id AND target_locale=p_locale
  RETURNING attempts INTO v_attempts;
  IF v_attempts >= 3 THEN
    UPDATE public.project_locales SET translation_status='failed'
    WHERE project_id=p_project_id AND locale=p_locale AND translation_status<>'manual';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_project_translations(uuid,text[],integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_project_translation(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.project_translation_status(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.claim_project_translation_jobs(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_project_translation_job(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_project_translation_job(uuid,text,text,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_project_translations(uuid,text[],integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_project_translation(uuid,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.project_translation_status(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_project_translation_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_project_translation_job(uuid,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_project_translation_job(uuid,text,text,integer,boolean) TO service_role;

-- Every minute, but only call the Edge worker when a job is due. Reuses the
-- Jobs scheduler Vault secrets (project URL + shared cron secret).
SELECT cron.schedule(
  'corelia-project-translations',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'corelia_jobs_project_url'
      ) || '/functions/v1/corelia-api?op=projects.translations.run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-corelia-jobs-cron-secret', (
          SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'corelia_jobs_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000
    )
    WHERE EXISTS (
      SELECT 1 FROM private.project_translation_jobs
      WHERE run_after <= now() AND attempts < 3 AND (locked_until IS NULL OR locked_until < now())
    );
  $job$
);
