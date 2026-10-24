DO $test$
DECLARE
  actor uuid := gen_random_uuid();
  project uuid := gen_random_uuid();
  claimed record;
  v_hash text;
  stored boolean;
BEGIN
  INSERT INTO auth.users(id) VALUES(actor);
  INSERT INTO public.projects(id,owner_id,slug,title,summary,source_type,visibility,i18n)
    VALUES(project,actor,'auto-translate-test','English title','English summary','standalone','private',
      '{"primary_content_locale":"en","supported_locales":["en","ja"]}');
  INSERT INTO public.project_locales(project_id,locale,data,translation_status)
    VALUES(project,'en','{"title":"English title","summary":"English summary"}','source'),
          (project,'vi','{"title":"Tên tự viết"}','manual');
  PERFORM set_config('role','service_role',true);

  -- A save queues enabled locales only; hand-written locales are left alone.
  PERFORM public.sync_project_translations(project,'{}',300);
  IF NOT EXISTS (SELECT 1 FROM private.project_translation_jobs WHERE project_id=project AND target_locale='ja' AND run_after > now())
    OR EXISTS (SELECT 1 FROM private.project_translation_jobs WHERE project_id=project AND target_locale IN ('vi','en')) THEN
    RAISE EXCEPTION 'sync queued the wrong locales';
  END IF;
  -- Debounced jobs are not claimable yet.
  IF EXISTS (SELECT 1 FROM public.claim_project_translation_jobs(5) WHERE project_id=project) THEN
    RAISE EXCEPTION 'debounced job was claimed early';
  END IF;

  PERFORM public.sync_project_translations(project,'{}',0);
  SELECT * INTO claimed FROM public.claim_project_translation_jobs(5) WHERE project_id=project;
  IF claimed IS NULL OR claimed.target_locale <> 'ja' OR claimed.primary_locale <> 'en' OR claimed.title <> 'English title' THEN
    RAISE EXCEPTION 'claim returned the wrong job';
  END IF;
  -- A leased job is not claimed twice.
  IF EXISTS (SELECT 1 FROM public.claim_project_translation_jobs(5) WHERE project_id=project) THEN
    RAISE EXCEPTION 'leased job was claimed twice';
  END IF;

  -- The owner saves again while the translation runs: the old result is discarded.
  RESET ROLE;
  UPDATE public.projects SET title='English title v2' WHERE id=project;
  PERFORM set_config('role','service_role',true);
  PERFORM public.sync_project_translations(project,'{}',0);
  stored := public.complete_project_translation_job(project,'ja',claimed.source_hash,'{"title":"古い","summary":"","description":"","progress":""}');
  IF stored OR EXISTS (SELECT 1 FROM public.project_locales WHERE project_id=project AND locale='ja') THEN
    RAISE EXCEPTION 'superseded translation was stored';
  END IF;

  SELECT * INTO claimed FROM public.claim_project_translation_jobs(5) WHERE project_id=project;
  stored := public.complete_project_translation_job(project,'ja',claimed.source_hash,'{"title":"新しい","summary":"概要","description":"","progress":""}');
  IF NOT stored OR NOT EXISTS (
    SELECT 1 FROM public.project_locales
    WHERE project_id=project AND locale='ja' AND translation_status='fresh' AND data->>'title'='新しい' AND source_hash=claimed.source_hash
  ) OR EXISTS (SELECT 1 FROM private.project_translation_jobs WHERE project_id=project) THEN
    RAISE EXCEPTION 'fresh translation was not stored';
  END IF;

  -- Unchanged source: no new job. Hand edit: marked manual, no job.
  PERFORM public.sync_project_translations(project,'{}',0);
  IF EXISTS (SELECT 1 FROM private.project_translation_jobs WHERE project_id=project) THEN
    RAISE EXCEPTION 'unchanged source queued a translation';
  END IF;
  RESET ROLE;
  UPDATE public.projects SET title='English title v3' WHERE id=project;
  PERFORM set_config('role','service_role',true);
  PERFORM public.sync_project_translations(project,ARRAY['ja'],0);
  IF EXISTS (SELECT 1 FROM private.project_translation_jobs WHERE project_id=project)
    OR (SELECT translation_status FROM public.project_locales WHERE project_id=project AND locale='ja') <> 'manual' THEN
    RAISE EXCEPTION 'hand-edited locale was queued';
  END IF;

  -- The owner asks for a fresh translation: queued now and the locale enabled.
  PERFORM public.request_project_translation(actor,project,'ko');
  IF NOT EXISTS (SELECT 1 FROM private.project_translation_jobs WHERE project_id=project AND target_locale='ko' AND run_after <= clock_timestamp())
    OR NOT (SELECT i18n->'supported_locales' FROM public.projects WHERE id=project) ? 'ko' THEN
    RAISE EXCEPTION 'request did not queue and enable the locale';
  END IF;
  IF (SELECT status FROM public.project_translation_status(actor,project) WHERE locale='ko') <> 'pending' THEN
    RAISE EXCEPTION 'status does not report the requested locale as pending';
  END IF;
  BEGIN
    PERFORM public.request_project_translation(actor,project,'en');
    RAISE EXCEPTION 'primary locale was accepted as a target';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%invalid_input:project_locale%' THEN RAISE; END IF; END;

  -- Three failures stop retries and surface as failed.
  SELECT * INTO claimed FROM public.claim_project_translation_jobs(5) WHERE project_id=project;
  PERFORM public.fail_project_translation_job(project,'ko','ai_unavailable:timeout',0,true);
  SELECT * INTO claimed FROM public.claim_project_translation_jobs(5) WHERE project_id=project;
  PERFORM public.fail_project_translation_job(project,'ko','ai_unavailable:timeout',0,true);
  SELECT * INTO claimed FROM public.claim_project_translation_jobs(5) WHERE project_id=project;
  PERFORM public.fail_project_translation_job(project,'ko','ai_unavailable:timeout',0,true);
  IF EXISTS (SELECT 1 FROM public.claim_project_translation_jobs(5) WHERE project_id=project)
    OR (SELECT status FROM public.project_translation_status(actor,project) WHERE locale='ko') <> 'failed' THEN
    RAISE EXCEPTION 'exhausted job kept retrying';
  END IF;
  RESET ROLE;

  -- Browser roles cannot reach the queue.
  PERFORM set_config('role','authenticated',true);
  BEGIN
    PERFORM public.claim_project_translation_jobs(5);
    RAISE EXCEPTION 'authenticated role can claim translation jobs';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='corelia-project-translations') THEN
    RAISE EXCEPTION 'translation worker is not scheduled';
  END IF;
  DELETE FROM public.projects WHERE id=project;
  DELETE FROM auth.users WHERE id=actor;
END;
$test$;
