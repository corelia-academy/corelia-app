DO $jobs_scheduler_vault_guard$
DECLARE
  missing_names text[];
  project_url text;
BEGIN
  SELECT array_agg(required.name ORDER BY required.name)
  INTO missing_names
  FROM (
    VALUES
      ('corelia_jobs_cron_secret'),
      ('corelia_jobs_project_url')
  ) AS required(name)
  LEFT JOIN vault.decrypted_secrets AS configured
    ON configured.name = required.name
  WHERE nullif(btrim(configured.decrypted_secret), '') IS NULL;

  IF missing_names IS NOT NULL THEN
    RAISE EXCEPTION
      'Jobs scheduler Vault configuration is missing or empty: %',
      array_to_string(missing_names, ', ');
  END IF;

  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'corelia_jobs_project_url';

  IF project_url !~ '^https://[a-z0-9]+\.supabase\.co/?$' THEN
    RAISE EXCEPTION
      'Jobs scheduler Vault project URL must be an HTTPS Supabase project URL';
  END IF;
END
$jobs_scheduler_vault_guard$;
