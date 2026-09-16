DO $verify$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'corelia_email_project_url' AND decrypted_secret <> '') THEN
    RAISE EXCEPTION 'Missing Vault secret corelia_email_project_url';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'corelia_email_worker_secret' AND decrypted_secret <> '') THEN
    RAISE EXCEPTION 'Missing Vault secret corelia_email_worker_secret';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'corelia-email-center' AND active) THEN
    RAISE EXCEPTION 'Email Center scheduler is missing or inactive';
  END IF;
END
$verify$;
