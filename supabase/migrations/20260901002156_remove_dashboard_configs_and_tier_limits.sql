-- Retire unused dashboard editorial configuration and legacy learner-AI tiers.
-- Intentionally omit CASCADE so unexpected dependencies fail the migration.

DROP TABLE public.dashboard_configs;
DROP TABLE public.tier_limits;

DO $verify$
BEGIN
  IF to_regclass('public.dashboard_configs') IS NOT NULL
     OR to_regclass('public.tier_limits') IS NOT NULL THEN
    RAISE EXCEPTION 'CONFIG_TABLE_RETIREMENT_INCOMPLETE';
  END IF;
END;
$verify$;
