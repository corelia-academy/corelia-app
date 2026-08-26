-- R5: make the hosted ensure_rls platform guard reproducible from migrations.
-- Production and Staging already carry this exact function/event trigger. The
-- clean local chain previously omitted it and fingerprint tooling hid the drift.

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

DO $$
DECLARE
  v_event text;
  v_function regprocedure;
BEGIN
  SELECT evtevent, evtfoid::regprocedure
  INTO v_event, v_function
  FROM pg_event_trigger
  WHERE evtname = 'ensure_rls';

  IF NOT FOUND THEN
    EXECUTE 'CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN (''CREATE TABLE'', ''CREATE TABLE AS'', ''SELECT INTO'') EXECUTE FUNCTION public.rls_auto_enable()';
  ELSIF v_event <> 'ddl_command_end'
     OR v_function <> 'public.rls_auto_enable()'::regprocedure THEN
    RAISE EXCEPTION 'R5_RLS_EVENT_TRIGGER_CONFLICT: ensure_rls has unexpected definition';
  END IF;
END;
$$;

ALTER EVENT TRIGGER ensure_rls ENABLE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_event_trigger e
    JOIN pg_proc p ON p.oid = e.evtfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE e.evtname = 'ensure_rls'
      AND e.evtevent = 'ddl_command_end'
      AND e.evtenabled = 'O'
      AND e.evttags = ARRAY['CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO']::text[]
      AND n.nspname = 'public'
      AND p.proname = 'rls_auto_enable'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    RAISE EXCEPTION 'R5_RLS_AUTO_ENABLE_CANONICALIZATION_FAILED';
  END IF;
END;
$$;
