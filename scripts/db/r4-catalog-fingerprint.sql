WITH catalog_entries AS (
  SELECT 'tables'::text AS category,
         format(
           '%I.%I|%s|%s|rls=%s|force_rls=%s',
           n.nspname, c.relname, c.relkind, c.relpersistence,
           c.relrowsecurity, c.relforcerowsecurity
         ) AS value
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'internal')
    AND c.relkind IN ('r', 'p')

  UNION ALL
  SELECT 'columns',
         format(
           '%I.%I|%I|%s|%s|%s|%s|%s',
           n.nspname, c.relname, a.attname,
           pg_catalog.format_type(a.atttypid, a.atttypmod),
           a.attnotnull,
           coalesce(pg_get_expr(d.adbin, d.adrelid), ''),
           a.attidentity,
           a.attgenerated
         )
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname IN ('public', 'private', 'internal')
    AND c.relkind IN ('r', 'p')
    AND a.attnum > 0
    AND NOT a.attisdropped

  UNION ALL
  SELECT 'constraints',
         format('%I.%I|%I|%s|%s', n.nspname, c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid, true))
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'internal')

  UNION ALL
  SELECT 'indexes',
         format('%I.%I|%I|%s', n.nspname, c.relname, i.relname, pg_get_indexdef(i.oid))
  FROM pg_index x
  JOIN pg_class c ON c.oid = x.indrelid
  JOIN pg_class i ON i.oid = x.indexrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'internal')

  UNION ALL
  SELECT 'policies',
         format(
           '%I.%I|%I|%s|%s|%s|%s|%s',
           n.nspname, c.relname, p.polname, p.polpermissive, p.polcmd,
           coalesce(array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles) ORDER BY rolname), ','), ''),
           coalesce(pg_get_expr(p.polqual, p.polrelid), ''),
           coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
         )
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'internal')

  UNION ALL
  SELECT 'triggers',
         format('%I.%I|%I|%s|%s', n.nspname, c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid, true))
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private', 'internal')
    AND NOT t.tgisinternal

  UNION ALL
  SELECT 'functions',
         format(
           '%I.%I(%s)|%s|%s|%s|%s|%s|%s',
           n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
           p.prokind, p.provolatile, p.prosecdef,
           coalesce(array_to_string(p.proconfig, ','), ''),
           pg_get_function_result(p.oid),
           replace(pg_get_functiondef(p.oid), E'\r\n', E'\n')
         )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'private', 'internal')
    AND NOT (n.nspname = 'public' AND p.proname = 'rls_auto_enable' AND pg_get_function_identity_arguments(p.oid) = '')
)
SELECT category,
       count(*)::int AS object_count,
       md5(string_agg(value, E'\n' ORDER BY value)) AS semantic_md5
FROM catalog_entries
GROUP BY category
ORDER BY category;
