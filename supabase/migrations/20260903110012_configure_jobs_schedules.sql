-- Keep Jobs automation reproducible and secret-free in migration history.
-- The project URL and shared scheduler secret are resolved from Vault only when
-- pg_cron executes each command.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $block$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN (
      'corelia-jobs-hourly',
      'corelia-jobs-discovery',
      'corelia-jobs-revalidation',
      'corelia-jobs-analytics'
    )
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END
$block$;

SELECT cron.schedule(
  'corelia-jobs-discovery',
  '7 * * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'corelia_jobs_project_url'
      ) || '/functions/v1/cron-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-corelia-jobs-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'corelia_jobs_cron_secret'
        )
      ),
      body := jsonb_build_object('mode', 'discovery', 'max_targets', 1),
      timeout_milliseconds := 120000
    );
  $job$
);

SELECT cron.schedule(
  'corelia-jobs-revalidation',
  '17 */6 * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'corelia_jobs_project_url'
      ) || '/functions/v1/cron-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-corelia-jobs-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'corelia_jobs_cron_secret'
        )
      ),
      body := jsonb_build_object('mode', 'revalidation', 'max_targets', 3),
      timeout_milliseconds := 120000
    );
  $job$
);

SELECT cron.schedule(
  'corelia-jobs-analytics',
  '30 4 * * *',
  $job$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'corelia_jobs_project_url'
      ) || '/functions/v1/cron-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-corelia-jobs-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'corelia_jobs_cron_secret'
        )
      ),
      body := jsonb_build_object('mode', 'analytics'),
      timeout_milliseconds := 120000
    );
  $job$
);
