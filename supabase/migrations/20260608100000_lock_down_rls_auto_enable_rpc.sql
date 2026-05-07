-- Lock down public.rls_auto_enable if present (Supabase linter:
-- anon_security_definer_function_executable / authenticated_security_definer_function_executable).
-- This function is not defined in repo migrations; it may exist only on some environments (e.g. staging).
-- Revoke PostgREST RPC access from anon/authenticated; keep callable only as superuser/service workflows.

DO $$
DECLARE
  sig regprocedure;
BEGIN
  SELECT p.oid::regprocedure INTO sig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'rls_auto_enable'
    AND pg_catalog.pg_function_is_visible(p.oid)
  LIMIT 1;

  IF sig IS NULL THEN
    RAISE NOTICE 'rls_auto_enable: skip (function not found)';
    RETURN;
  END IF;

  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);

  RAISE NOTICE 'rls_auto_enable: revoked EXECUTE from PUBLIC/anon/authenticated on %', sig;
END;
$$;
