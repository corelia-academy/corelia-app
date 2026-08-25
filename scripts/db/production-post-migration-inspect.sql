-- Read-only semantic inspection for the Production post-migration gate.
-- Every semantic object is returned as deterministic JSON. The companion
-- verifier rejects missing, duplicate, unexpected, malformed, or mismatched
-- rows. This query must remain side-effect free.

WITH constraint_catalog AS (
  SELECT
    c.oid,
    n.nspname AS table_schema,
    rel.relname AS table_name,
    c.conname AS constraint_name,
    c.contype AS constraint_type,
    c.condeferrable AS is_deferrable,
    c.condeferred AS is_initially_deferred,
    c.convalidated AS is_validated,
    ARRAY(
      SELECT a.attname
      FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = key.attnum
      ORDER BY key.ord
    ) AS local_columns,
    ref_n.nspname AS referenced_schema,
    ref_rel.relname AS referenced_table,
    CASE WHEN c.contype = 'f' THEN ARRAY(
      SELECT a.attname
      FROM unnest(c.confkey) WITH ORDINALITY AS key(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = key.attnum
      ORDER BY key.ord
    ) ELSE ARRAY[]::name[] END AS referenced_columns,
    CASE c.confupdtype
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT'
    END AS on_update,
    CASE c.confdeltype
      WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT'
    END AS on_delete
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  LEFT JOIN pg_class ref_rel ON ref_rel.oid = c.confrelid
  LEFT JOIN pg_namespace ref_n ON ref_n.oid = ref_rel.relnamespace
),
policy_catalog AS (
  SELECT
    n.nspname AS table_schema,
    rel.relname AS table_name,
    p.polname AS policy_name,
    p.polpermissive AS permissive,
    CASE p.polcmd
      WHEN '*' THEN 'ALL' WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
      WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
    END AS command,
    ARRAY(
      SELECT CASE WHEN role_oid = 0 THEN 'public' ELSE pg_get_userbyid(role_oid) END
      FROM unnest(p.polroles) AS role_oid
      ORDER BY 1
    ) AS roles,
    regexp_replace(pg_get_expr(p.polqual, p.polrelid, false), '\s+', ' ', 'g') AS using_expression,
    regexp_replace(pg_get_expr(p.polwithcheck, p.polrelid, false), '\s+', ' ', 'g') AS with_check_expression
  FROM pg_policy p
  JOIN pg_class rel ON rel.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
),
trigger_catalog AS (
  SELECT
    n.nspname AS table_schema,
    rel.relname AS table_name,
    t.tgname AS trigger_name,
    CASE t.tgenabled
      WHEN 'O' THEN 'ORIGIN' WHEN 'R' THEN 'REPLICA'
      WHEN 'A' THEN 'ALWAYS' WHEN 'D' THEN 'DISABLED'
    END AS enabled,
    CASE
      WHEN (t.tgtype & 64) <> 0 THEN 'INSTEAD OF'
      WHEN (t.tgtype & 2) <> 0 THEN 'BEFORE'
      ELSE 'AFTER'
    END AS timing,
    CASE WHEN (t.tgtype & 1) <> 0 THEN 'ROW' ELSE 'STATEMENT' END AS level,
    array_remove(ARRAY[
      CASE WHEN (t.tgtype & 4) <> 0 THEN 'INSERT' END,
      CASE WHEN (t.tgtype & 16) <> 0 THEN 'UPDATE' END,
      CASE WHEN (t.tgtype & 8) <> 0 THEN 'DELETE' END,
      CASE WHEN (t.tgtype & 32) <> 0 THEN 'TRUNCATE' END
    ], NULL) AS events,
    ARRAY(
      SELECT a.attname
      FROM unnest(t.tgattr::smallint[]) WITH ORDINALITY AS trigger_column(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = t.tgrelid AND a.attnum = trigger_column.attnum
      ORDER BY trigger_column.ord
    ) AS update_columns,
    fn_n.nspname AS function_schema,
    fn.proname AS function_name,
    pg_get_function_identity_arguments(fn.oid) AS function_identity_arguments,
    regexp_replace(lower(pg_get_triggerdef(t.oid, false)), '\s+', ' ', 'g') AS normalized_definition
  FROM pg_trigger t
  JOIN pg_class rel ON rel.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_proc fn ON fn.oid = t.tgfoid
  JOIN pg_namespace fn_n ON fn_n.oid = fn.pronamespace
  WHERE NOT t.tgisinternal
),
function_catalog AS (
  SELECT
    p.oid,
    n.nspname AS function_schema,
    p.proname AS function_name,
    ARRAY(
      SELECT format_type(arg_type, NULL)
      FROM unnest(p.proargtypes::oid[]) WITH ORDINALITY AS arg(arg_type, ord)
      ORDER BY arg.ord
    ) AS argument_types,
    pg_get_function_result(p.oid) AS result_type,
    p.prosecdef AS security_definer,
    COALESCE(p.proconfig, ARRAY[]::text[]) AS configuration,
    l.lanname AS language,
    pg_get_function_identity_arguments(p.oid) AS function_identity_arguments,
    lower(btrim(p.prosrc)) AS normalized_body,
    ARRAY(
      SELECT DISTINCT CASE WHEN acl.grantee = 0 THEN 'public' ELSE pg_get_userbyid(acl.grantee) END
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE acl.privilege_type = 'EXECUTE'
        AND acl.grantee <> p.proowner
      ORDER BY 1
    ) AS explicit_execute_roles
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
),
column_catalog AS (
  SELECT
    n.nspname AS table_schema,
    rel.relname AS table_name,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS not_null,
    pg_get_expr(ad.adbin, ad.adrelid, false) AS default_expression
  FROM pg_attribute a
  JOIN pg_class rel ON rel.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
relation_catalog AS (
  SELECT
    n.nspname AS table_schema,
    rel.relname AS table_name,
    rel.relrowsecurity AS rls_enabled,
    rel.relforcerowsecurity AS rls_forced
  FROM pg_class rel
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE rel.relkind IN ('r', 'p')
),
inspection AS (
  SELECT 'invariant.conversation_orphans' AS metric, COUNT(*)::text AS value
  FROM public.ai_conversations c
  LEFT JOIN public.ai_chat_sessions s ON s.id = c.session_id
  WHERE c.session_id IS NOT NULL AND s.id IS NULL

  UNION ALL
  SELECT 'invariant.conversation_owner_mismatches', COUNT(*)::text
  FROM public.ai_conversations c
  JOIN public.ai_chat_sessions s ON s.id = c.session_id
  WHERE c.user_id <> s.user_id

  UNION ALL
  SELECT 'invariant.session_count_mismatches', COUNT(*)::text
  FROM (
    SELECT s.id
    FROM public.ai_chat_sessions s
    LEFT JOIN public.ai_conversations c ON c.session_id = s.id
    GROUP BY s.id, s.message_count
    HAVING s.message_count <> COUNT(c.id) FILTER (WHERE c.status = 'completed')
  ) mismatches

  UNION ALL
  SELECT 'invariant.orphan_ai_vouchers', COUNT(*)::text
  FROM public.ai_vouchers v
  LEFT JOIN public.ai_voucher_batches b ON b.id = v.batch_id
  WHERE v.batch_id IS NOT NULL AND b.id IS NULL

  UNION ALL
  SELECT 'invariant.orphan_ai_voucher_redemptions', COUNT(*)::text
  FROM public.ai_voucher_redemptions r
  LEFT JOIN public.ai_vouchers v ON v.id = r.voucher_id
  WHERE v.id IS NULL

  UNION ALL
  SELECT 'invariant.duplicate_project_provenance_groups', COUNT(*)::text
  FROM (
    SELECT owner_id, source_type, source_submission_id
    FROM public.projects
    WHERE source_submission_id IS NOT NULL
    GROUP BY owner_id, source_type, source_submission_id
    HAVING COUNT(*) > 1
  ) duplicates

  UNION ALL
  SELECT 'invariant.paid_course_purchase_missing_access', COUNT(*)::text
  FROM public.payment_transactions t
  WHERE t.status = 'paid'
    AND t.purpose = 'course_purchase'
    AND NOT EXISTS (
      SELECT 1 FROM public.course_payment_access a
      WHERE a.user_id = t.user_id
        AND a.course_id = t.course_id
        AND a.full_access_granted = true
        AND a.status = 'active'
    )

  UNION ALL
  SELECT 'invariant.paid_course_purchase_missing_enrollment', COUNT(*)::text
  FROM public.payment_transactions t
  WHERE t.status = 'paid'
    AND t.purpose = 'course_purchase'
    AND NOT EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = t.user_id AND e.course_id = t.course_id
    )

  UNION ALL
  SELECT 'invariant.refund_ledger_exceeds_payment', COUNT(*)::text
  FROM (
    SELECT t.id
    FROM public.payment_transactions t
    JOIN public.payment_refunds r ON r.payment_transaction_id = t.id AND r.status = 'completed'
    GROUP BY t.id, t.amount_vnd
    HAVING SUM(r.amount_vnd) > t.amount_vnd
  ) over_refunded

  UNION ALL
  SELECT 'invariant.financial_rpc_client_execute_grants', (
    has_function_privilege('anon', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')::int
    + has_function_privilege('authenticated', 'public.process_successful_payment(text,jsonb,timestamp with time zone)', 'EXECUTE')::int
    + has_function_privilege('anon', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')::int
    + has_function_privilege('authenticated', 'public.process_payment_refund(text,integer,text,uuid,jsonb)', 'EXECUTE')::int
  )::text

  UNION ALL
  SELECT 'constraint.ai_chat_sessions_id_user_id_unique', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'constraint_type', constraint_type, 'local_columns', local_columns,
      'deferrable', is_deferrable, 'initially_deferred', is_initially_deferred,
      'validated', is_validated
    )::text
    FROM constraint_catalog WHERE constraint_name = 'ai_chat_sessions_id_user_id_unique'
  ), 'null')

  UNION ALL
  SELECT 'constraint.ai_conversations_session_user_fkey', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'constraint_type', constraint_type, 'local_columns', local_columns,
      'referenced_schema', referenced_schema, 'referenced_table', referenced_table,
      'referenced_columns', referenced_columns,
      'on_update', on_update, 'on_delete', on_delete,
      'deferrable', is_deferrable, 'initially_deferred', is_initially_deferred,
      'validated', is_validated
    )::text
    FROM constraint_catalog WHERE constraint_name = 'ai_conversations_session_user_fkey'
  ), 'null')

  UNION ALL
  SELECT 'policy.own_conversations', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'policy_name', policy_name, 'permissive', permissive,
      'command', command, 'roles', roles,
      'using_expression', using_expression, 'with_check_expression', with_check_expression
    )::text
    FROM policy_catalog
    WHERE policy_name = 'own_conversations'
      AND table_schema = 'public' AND table_name = 'ai_conversations'
  ), 'null')

  UNION ALL
  SELECT 'trigger.trg_sync_ai_chat_session_message_count', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'trigger_name', trigger_name, 'enabled', enabled,
      'timing', timing, 'level', level, 'events', events,
      'function_schema', function_schema, 'function_name', function_name,
      'function_identity_arguments', function_identity_arguments
    )::text
    FROM trigger_catalog
    WHERE trigger_name = 'trg_sync_ai_chat_session_message_count'
      AND table_schema = 'public' AND table_name = 'ai_conversations'
  ), 'null')

  UNION ALL
  SELECT 'trigger.trg_guard_ai_chat_session_message_count', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'trigger_name', trigger_name, 'enabled', enabled,
      'timing', timing, 'level', level, 'events', events,
      'update_columns', update_columns,
      'function_schema', function_schema, 'function_name', function_name,
      'function_identity_arguments', function_identity_arguments,
      'normalized_definition', normalized_definition
    )::text
    FROM trigger_catalog
    WHERE trigger_name = 'trg_guard_ai_chat_session_message_count'
      AND table_schema = 'public' AND table_name = 'ai_chat_sessions'
  ), 'null')

  UNION ALL
  SELECT 'function.guard_ai_chat_session_message_count', COALESCE((
    SELECT jsonb_build_object(
      'function_schema', function_schema, 'function_name', function_name,
      'function_identity_arguments', function_identity_arguments,
      'result_type', result_type, 'language', language,
      'security_definer', security_definer, 'configuration', configuration,
      'normalized_body', normalized_body
    )::text
    FROM function_catalog
    WHERE function_schema = 'public'
      AND function_name = 'guard_ai_chat_session_message_count'
      AND argument_types = ARRAY[]::text[]
  ), 'null')

  UNION ALL
  SELECT 'function.record_ai_successful_usage', COALESCE((
    SELECT jsonb_build_object(
      'function_schema', function_schema, 'function_name', function_name,
      'argument_types', argument_types, 'result_type', result_type,
      'security_definer', security_definer, 'configuration', configuration,
      'explicit_execute_roles', explicit_execute_roles
    )::text
    FROM function_catalog
    WHERE function_schema = 'public'
      AND function_name = 'record_ai_successful_usage'
      AND argument_types = ARRAY['uuid', 'text', 'uuid', 'text', 'integer', 'integer', 'numeric', 'boolean']
  ), 'null')

  UNION ALL
  SELECT 'function.patch_hackathon_metrics_snapshot', COALESCE((
    SELECT jsonb_build_object(
      'function_schema', function_schema, 'function_name', function_name,
      'argument_types', argument_types, 'result_type', result_type,
      'security_definer', security_definer, 'configuration', configuration,
      'explicit_execute_roles', explicit_execute_roles
    )::text
    FROM function_catalog
    WHERE function_schema = 'public'
      AND function_name = 'patch_hackathon_metrics_snapshot'
      AND argument_types = ARRAY['text', 'jsonb']
  ), 'null')

  UNION ALL
  SELECT 'function.process_successful_payment', COALESCE((
    SELECT jsonb_build_object(
      'function_schema', function_schema, 'function_name', function_name,
      'argument_types', argument_types, 'result_type', result_type,
      'security_definer', security_definer, 'configuration', configuration,
      'explicit_execute_roles', explicit_execute_roles
    )::text
    FROM function_catalog
    WHERE function_schema = 'public'
      AND function_name = 'process_successful_payment'
      AND argument_types = ARRAY['text', 'jsonb', 'timestamp with time zone']
  ), 'null')

  UNION ALL
  SELECT 'function.process_payment_refund', COALESCE((
    SELECT jsonb_build_object(
      'function_schema', function_schema, 'function_name', function_name,
      'argument_types', argument_types, 'result_type', result_type,
      'security_definer', security_definer, 'configuration', configuration,
      'explicit_execute_roles', explicit_execute_roles
    )::text
    FROM function_catalog
    WHERE function_schema = 'public'
      AND function_name = 'process_payment_refund'
      AND argument_types = ARRAY['text', 'integer', 'text', 'uuid', 'jsonb']
  ), 'null')

  UNION ALL
  SELECT 'table.ai_model_pricing.rls', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'rls_enabled', rls_enabled, 'rls_forced', rls_forced
    )::text
    FROM relation_catalog
    WHERE table_schema = 'public' AND table_name = 'ai_model_pricing'
  ), 'null')

  UNION ALL
  SELECT 'table.ai_usage_log.rls', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'rls_enabled', rls_enabled, 'rls_forced', rls_forced
    )::text
    FROM relation_catalog
    WHERE table_schema = 'public' AND table_name = 'ai_usage_log'
  ), 'null')

  UNION ALL
  SELECT 'table.tier_limits.rls', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'rls_enabled', rls_enabled, 'rls_forced', rls_forced
    )::text
    FROM relation_catalog
    WHERE table_schema = 'public' AND table_name = 'tier_limits'
  ), 'null')

  UNION ALL
  SELECT 'column.payment_transactions.settled_at', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'column_name', column_name, 'data_type', data_type,
      'not_null', not_null, 'default_expression', default_expression
    )::text
    FROM column_catalog
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'settled_at'
  ), 'null')

  UNION ALL
  SELECT 'column.course_payment_access.full_access_transaction_id', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'column_name', column_name, 'data_type', data_type,
      'not_null', not_null, 'default_expression', default_expression
    )::text
    FROM column_catalog
    WHERE table_schema = 'public' AND table_name = 'course_payment_access' AND column_name = 'full_access_transaction_id'
  ), 'null')

  UNION ALL
  SELECT 'column.course_payment_access.certificate_fee_transaction_id', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'column_name', column_name, 'data_type', data_type,
      'not_null', not_null, 'default_expression', default_expression
    )::text
    FROM column_catalog
    WHERE table_schema = 'public' AND table_name = 'course_payment_access' AND column_name = 'certificate_fee_transaction_id'
  ), 'null')

  UNION ALL
  SELECT 'column.ai_voucher_batches.archived_at', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'column_name', column_name, 'data_type', data_type,
      'not_null', not_null, 'default_expression', default_expression
    )::text
    FROM column_catalog
    WHERE table_schema = 'public' AND table_name = 'ai_voucher_batches' AND column_name = 'archived_at'
  ), 'null')

  UNION ALL
  SELECT 'column.ai_voucher_batches.archived_by', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'column_name', column_name, 'data_type', data_type,
      'not_null', not_null, 'default_expression', default_expression
    )::text
    FROM column_catalog
    WHERE table_schema = 'public' AND table_name = 'ai_voucher_batches' AND column_name = 'archived_by'
  ), 'null')

  UNION ALL
  SELECT 'constraint.ai_voucher_batches_archived_by_fkey', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'constraint_type', constraint_type, 'local_columns', local_columns,
      'referenced_schema', referenced_schema, 'referenced_table', referenced_table,
      'referenced_columns', referenced_columns,
      'on_update', on_update, 'on_delete', on_delete,
      'deferrable', is_deferrable, 'initially_deferred', is_initially_deferred,
      'validated', is_validated
    )::text
    FROM constraint_catalog WHERE constraint_name = 'ai_voucher_batches_archived_by_fkey'
  ), 'null')

  UNION ALL
  SELECT 'constraint.ai_vouchers_batch_id_fkey', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'constraint_type', constraint_type, 'local_columns', local_columns,
      'referenced_schema', referenced_schema, 'referenced_table', referenced_table,
      'referenced_columns', referenced_columns,
      'on_update', on_update, 'on_delete', on_delete,
      'deferrable', is_deferrable, 'initially_deferred', is_initially_deferred,
      'validated', is_validated
    )::text
    FROM constraint_catalog WHERE constraint_name = 'ai_vouchers_batch_id_fkey'
  ), 'null')

  UNION ALL
  SELECT 'constraint.ai_voucher_redemptions_voucher_id_fkey', COALESCE((
    SELECT jsonb_build_object(
      'table_schema', table_schema, 'table_name', table_name,
      'constraint_type', constraint_type, 'local_columns', local_columns,
      'referenced_schema', referenced_schema, 'referenced_table', referenced_table,
      'referenced_columns', referenced_columns,
      'on_update', on_update, 'on_delete', on_delete,
      'deferrable', is_deferrable, 'initially_deferred', is_initially_deferred,
      'validated', is_validated
    )::text
    FROM constraint_catalog WHERE constraint_name = 'ai_voucher_redemptions_voucher_id_fkey'
  ), 'null')
)
SELECT metric, value
FROM inspection
ORDER BY metric;
