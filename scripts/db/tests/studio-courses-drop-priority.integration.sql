-- studio_courses.priority is gone: the column no longer exists, admin keeps the other writable
-- columns, and studio_set_manual_order stays callable by the service role only.
BEGIN;

DO $$
DECLARE
  n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'studio_courses' AND column_name = 'priority') THEN
    RAISE EXCEPTION 'studio_courses.priority still exists';
  END IF;

  SELECT count(*) INTO n FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'studio_courses' AND grantee = 'authenticated'
    AND privilege_type IN ('INSERT', 'UPDATE') AND column_name NOT IN ('title', 'level', 'status', 'policy_tier', 'scope_note', 'audience', 'corelia_direction', 'content_locale', 'research_period_days');
  IF n <> 0 THEN RAISE EXCEPTION 'authenticated can write % unexpected studio_courses columns', n; END IF;

  SELECT count(*) INTO n FROM information_schema.column_privileges
  WHERE table_schema = 'public' AND table_name = 'studio_courses' AND grantee = 'authenticated'
    AND privilege_type IN ('INSERT', 'UPDATE') AND column_name IN ('title', 'level', 'status', 'policy_tier', 'scope_note', 'audience', 'corelia_direction', 'content_locale', 'research_period_days');
  IF n <> 18 THEN RAISE EXCEPTION 'authenticated lost writable studio_courses columns (% of 18 left)', n; END IF;

  IF has_function_privilege('authenticated', 'public.studio_set_manual_order(uuid, integer, text, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.studio_set_manual_order(uuid, integer, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'studio_set_manual_order is callable by a client role';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.studio_set_manual_order(uuid, integer, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'studio_set_manual_order is not callable by service_role';
  END IF;
END $$;

ROLLBACK;
