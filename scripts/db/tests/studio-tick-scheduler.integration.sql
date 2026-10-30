BEGIN;

-- Inspect the schedule only; this test never executes cron.job.command or calls HTTP.
DO $studio_tick_test$
DECLARE
  v_job_count integer;
  v_schedule text;
  v_active boolean;
  v_command text;
  v_upper_command text;
  v_where_exists integer;
  v_and_exists integer;
  v_nullif_count integer;
  v_studio_secret_present boolean;
  v_guard_result boolean;
BEGIN
  SELECT count(*) INTO v_job_count
  FROM cron.job
  WHERE jobname = 'corelia-studio-tick';
  IF v_job_count <> 1 THEN
    RAISE EXCEPTION 'Expected one corelia-studio-tick job, found %', v_job_count;
  END IF;

  SELECT schedule, active, command
  INTO v_schedule, v_active, v_command
  FROM cron.job
  WHERE jobname = 'corelia-studio-tick';
  IF v_schedule <> '30 seconds' THEN
    RAISE EXCEPTION 'Expected 30-second schedule, found %', v_schedule;
  END IF;
  IF v_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'corelia-studio-tick is not active';
  END IF;

  v_upper_command := upper(v_command);
  IF v_command NOT ILIKE '%net.http_post%'
     OR v_command NOT ILIKE '%/functions/v1/corelia-api?op=studio.tick%'
     OR v_command NOT ILIKE '%''Content-Type'', ''application/json''%'
     OR v_command NOT ILIKE '%x-corelia-studio-cron-secret%'
     OR v_command NOT ILIKE '%body := ''{}''::jsonb%'
     OR v_command NOT ILIKE '%timeout_milliseconds := 150000%' THEN
    RAISE EXCEPTION 'Studio tick command is missing a required HTTP request field';
  END IF;
  IF position('CORELIA_JOBS_PROJECT_URL' in v_upper_command) = 0
     OR position('CORELIA_STUDIO_CRON_SECRET' in v_upper_command) = 0
     OR position('FROM VAULT.DECRYPTED_SECRETS' in v_upper_command) = 0 THEN
    RAISE EXCEPTION 'Studio tick URL or secret is not loaded from Vault';
  END IF;
  IF position('HTTP://' in v_upper_command) > 0 OR position('HTTPS://' in v_upper_command) > 0 THEN
    RAISE EXCEPTION 'Studio tick command contains a literal URL';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name IN ('corelia_jobs_project_url', 'corelia_studio_cron_secret')
      AND nullif(btrim(decrypted_secret), '') IS NOT NULL
      AND position(decrypted_secret in v_command) > 0
  ) THEN
    RAISE EXCEPTION 'Studio tick command contains a Vault value instead of a Vault lookup';
  END IF;

  v_where_exists := position('WHERE EXISTS' in v_upper_command);
  v_and_exists := position('AND EXISTS' in v_upper_command);
  v_nullif_count := (
    length(v_upper_command)
    - length(replace(v_upper_command, 'NULLIF(BTRIM(DECRYPTED_SECRET)', ''))
  ) / length('NULLIF(BTRIM(DECRYPTED_SECRET)');
  IF v_where_exists = 0 OR v_and_exists <= v_where_exists OR v_nullif_count <> 2 THEN
    RAISE EXCEPTION 'Studio tick must guard both Vault secrets with non-empty checks';
  END IF;
  IF position('CORELIA_JOBS_PROJECT_URL' in substring(v_upper_command FROM v_where_exists FOR v_and_exists - v_where_exists)) = 0
     OR position('CORELIA_STUDIO_CRON_SECRET' in substring(v_upper_command FROM v_and_exists)) = 0 THEN
    RAISE EXCEPTION 'Each Vault secret must be checked by its own WHERE EXISTS guard';
  END IF;

  -- The local and CI database fixtures must omit the Studio secret. Do not create a fake Vault value.
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'corelia_studio_cron_secret'
      AND nullif(btrim(decrypted_secret), '') IS NOT NULL
  ) INTO v_studio_secret_present;
  IF v_studio_secret_present THEN
    RAISE EXCEPTION 'Cannot verify the missing-Studio-secret guard: Vault already contains it';
  END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM vault.decrypted_secrets
      WHERE name = 'corelia_jobs_project_url'
        AND nullif(btrim(decrypted_secret), '') IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM vault.decrypted_secrets
      WHERE name = 'corelia_studio_cron_secret'
        AND nullif(btrim(decrypted_secret), '') IS NOT NULL
    )
  INTO v_guard_result;
  IF v_guard_result THEN
    RAISE EXCEPTION 'Studio tick Vault guard returned true without a Studio secret';
  END IF;
END
$studio_tick_test$;

ROLLBACK;
