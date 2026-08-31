-- Read-only proof that learner-facing AI has been removed from the active DB.
WITH target_tables(name) AS (
  VALUES
    ('ai_chat_sessions'), ('ai_conversations'), ('ai_subscriptions'),
    ('ai_usage_daily'), ('ai_usage_monthly'), ('ai_usage_log'),
    ('ai_model_pricing'), ('knowledge_chunks'), ('user_learning_profile'),
    ('learning_observations'), ('ai_voucher_batches'), ('ai_vouchers'),
    ('ai_voucher_redemptions'), ('lesson_summaries'), ('flashcard_decks'),
    ('lesson_readiness_checks'), ('learning_paths')
), remaining_relations AS (
  SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND c.relname IN (SELECT name FROM target_tables)
), remaining_functions AS (
  SELECT n.nspname AS schema_name, p.proname AS function_name,
         pg_get_function_identity_arguments(p.oid) AS arguments
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND n.nspname IN ('public', 'private')
    AND (
      p.proname IN (
        'guard_ai_chat_session_message_count',
        'guard_retired_ai_subscription_writes',
        'guard_retired_ai_voucher_redemption_writes',
        'match_knowledge_chunks',
        'record_ai_successful_usage',
        'reconcile_historical_ai_payment',
        'sync_ai_chat_session_message_count'
      )
      OR pg_get_functiondef(p.oid) ~* 'ai_subscription'
    )
), remaining_quota_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'tier_limits'
    AND column_name IN (
      'monthly_messages', 'haiku_only', 'monthly_tokens', 'rolling_3h_tokens'
    )
)
SELECT jsonb_build_object(
  'learner_ai_relations',
    (SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM remaining_relations r),
  'learner_ai_functions',
    (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM remaining_functions f),
  'learner_ai_payment_rows',
    (SELECT count(*) FROM public.payment_transactions WHERE purpose = 'ai_subscription'),
  'learner_ai_quota_columns',
    (SELECT COALESCE(jsonb_agg(column_name), '[]'::jsonb) FROM remaining_quota_columns),
  'vector_extension_installed',
    EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector'),
  'instructor_course_tables_present', jsonb_build_object(
    'courses', to_regclass('public.courses') IS NOT NULL,
    'course_sections', to_regclass('public.course_sections') IS NOT NULL,
    'course_lessons', to_regclass('public.course_lessons') IS NOT NULL,
    'course_section_questions', to_regclass('public.course_section_questions') IS NOT NULL
  )
) AS learner_ai_retirement_audit;
