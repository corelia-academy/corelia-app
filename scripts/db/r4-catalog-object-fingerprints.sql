SELECT 'tables'::text AS category,
       format('%I.%I', n.nspname, c.relname) AS object_key,
       md5(format(
         '%s|%s|rls=%s|force_rls=%s',
         c.relkind,
         c.relpersistence,
         c.relrowsecurity,
         c.relforcerowsecurity
       )) AS semantic_md5
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'private', 'internal')
  AND c.relkind IN ('r', 'p')

UNION ALL
SELECT 'columns'::text AS category,
       format('%I.%I.%I', n.nspname, c.relname, a.attname) AS object_key,
       md5(format(
         '%s|%s|%s|%s|%s',
         pg_catalog.format_type(a.atttypid, a.atttypmod),
         a.attnotnull,
         coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
         a.attidentity,
         a.attgenerated
       )) AS semantic_md5
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname IN ('public', 'private', 'internal')
  AND c.relkind IN ('r', 'p')
  AND a.attnum > 0
  AND NOT a.attisdropped

UNION ALL
SELECT 'functions',
       format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)),
       md5(format(
         '%s|%s|%s|%s|%s|%s',
         p.prokind,
         p.provolatile,
         p.prosecdef,
         coalesce(array_to_string(p.proconfig, ','), ''),
         pg_get_function_result(p.oid),
         replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')
       ))
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private', 'internal')

UNION ALL
SELECT 'event_triggers',
       e.evtname,
       md5(format(
         '%s|%s|%s|%s',
         e.evtevent,
         e.evtenabled,
         e.evtfoid::regprocedure,
         coalesce(array_to_string(e.evttags, ','), '')
       ))
FROM pg_event_trigger e
WHERE e.evtname IN ('ensure_rls')
ORDER BY category, object_key;
