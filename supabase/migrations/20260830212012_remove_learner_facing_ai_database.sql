-- Permanently remove the retired learner-facing AI subsystem.
-- Instructor authoring remains stateless in the generate-description and
-- generate-questions Edge Functions and does not depend on these objects.

DO $preflight$
DECLARE
  v_unexpected text;
BEGIN
  WITH target_tables(name) AS (
    VALUES
      ('ai_chat_sessions'), ('ai_conversations'), ('ai_subscriptions'),
      ('ai_usage_daily'), ('ai_usage_monthly'), ('ai_usage_log'),
      ('ai_model_pricing'), ('knowledge_chunks'), ('user_learning_profile'),
      ('learning_observations'), ('ai_voucher_batches'), ('ai_vouchers'),
      ('ai_voucher_redemptions'), ('lesson_summaries'), ('flashcard_decks'),
      ('lesson_readiness_checks'), ('learning_paths')
  ), allowed_functions(schema_name, function_name) AS (
    VALUES
      ('private', 'sync_ai_chat_session_message_count'),
      ('public', 'guard_ai_chat_session_message_count'),
      ('public', 'guard_retired_ai_subscription_writes'),
      ('public', 'guard_retired_ai_voucher_redemption_writes'),
      ('public', 'match_knowledge_chunks'),
      ('public', 'process_unsuccessful_payment_callback'),
      ('public', 'record_ai_successful_usage')
  )
  SELECT string_agg(format('%I.%I(%s)', n.nspname, p.proname,
                           pg_get_function_identity_arguments(p.oid)), ', ')
  INTO v_unexpected
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND n.nspname IN ('public', 'private')
    AND EXISTS (
      SELECT 1
      FROM target_tables t
      WHERE pg_get_functiondef(p.oid) ~
        ('(^|[^a-zA-Z0-9_])' || t.name || '([^a-zA-Z0-9_]|$)')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM allowed_functions a
      WHERE a.schema_name = n.nspname
        AND a.function_name = p.proname
    );

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'LEARNER_AI_RETIREMENT_ABORTED: unexpected function dependencies: %',
      v_unexpected;
  END IF;

  WITH target_tables(name) AS (
    VALUES
      ('ai_chat_sessions'), ('ai_conversations'), ('ai_subscriptions'),
      ('ai_usage_daily'), ('ai_usage_monthly'), ('ai_usage_log'),
      ('ai_model_pricing'), ('knowledge_chunks'), ('user_learning_profile'),
      ('learning_observations'), ('ai_voucher_batches'), ('ai_vouchers'),
      ('ai_voucher_redemptions'), ('lesson_summaries'), ('flashcard_decks'),
      ('lesson_readiness_checks'), ('learning_paths')
  )
  SELECT string_agg(format('%I.%I -> %I.%I', source_ns.nspname,
                           source.relname, target_ns.nspname, target.relname), ', ')
  INTO v_unexpected
  FROM pg_constraint constraint_row
  JOIN pg_class source ON source.oid = constraint_row.conrelid
  JOIN pg_namespace source_ns ON source_ns.oid = source.relnamespace
  JOIN pg_class target ON target.oid = constraint_row.confrelid
  JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
  WHERE constraint_row.contype = 'f'
    AND target_ns.nspname = 'public'
    AND target.relname IN (SELECT name FROM target_tables)
    AND source.relname NOT IN (SELECT name FROM target_tables);

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'LEARNER_AI_RETIREMENT_ABORTED: unexpected external foreign keys: %',
      v_unexpected;
  END IF;

  WITH target_tables(name) AS (
    VALUES
      ('ai_chat_sessions'), ('ai_conversations'), ('ai_subscriptions'),
      ('ai_usage_daily'), ('ai_usage_monthly'), ('ai_usage_log'),
      ('ai_model_pricing'), ('knowledge_chunks'), ('user_learning_profile'),
      ('learning_observations'), ('ai_voucher_batches'), ('ai_vouchers'),
      ('ai_voucher_redemptions'), ('lesson_summaries'), ('flashcard_decks'),
      ('lesson_readiness_checks'), ('learning_paths')
  )
  SELECT string_agg(format('%I.%I', view_schema, view_name), ', ')
  INTO v_unexpected
  FROM information_schema.view_table_usage
  WHERE table_schema = 'public'
    AND table_name IN (SELECT name FROM target_tables);

  IF v_unexpected IS NOT NULL THEN
    RAISE EXCEPTION
      'LEARNER_AI_RETIREMENT_ABORTED: unexpected dependent views: %',
      v_unexpected;
  END IF;
END;
$preflight$;

-- Remove the retired payment product and every row directly derived from it.
DELETE FROM public.payment_refunds
WHERE payment_transaction_id IN (
  SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
);

DELETE FROM public.payment_transaction_items
WHERE payment_transaction_id IN (
  SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
);

DELETE FROM public.course_entitlement_grants
WHERE source_transaction_id IN (
  SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
);

DELETE FROM public.course_payment_access
WHERE source_transaction_id IN (
    SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
  )
  OR full_access_transaction_id IN (
    SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
  )
  OR certificate_fee_transaction_id IN (
    SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
  );

DELETE FROM public.enrollments
WHERE paid_order_id IN (
  SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
);

-- These retired tables own explicit foreign keys to payment_transactions.
-- Delete their rows before the parent payments; the tables themselves are
-- dropped later with the rest of the subsystem.
DELETE FROM public.ai_voucher_redemptions
WHERE payment_transaction_id IN (
  SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
);

DELETE FROM public.ai_subscriptions
WHERE payment_transaction_id IN (
  SELECT id FROM public.payment_transactions WHERE purpose = 'ai_subscription'
);

DELETE FROM public.payment_transactions WHERE purpose = 'ai_subscription';

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT payment_transactions_purpose_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_purpose_check
  CHECK (purpose IN ('course_purchase', 'certificate_fee'));

-- Rewrite shared payment RPCs so the live database contains no retired-AI branch.
DO $rewrite_successful_payment$
DECLARE
  v_definition text;
  v_start integer;
  v_finish integer;
BEGIN
  SELECT pg_get_functiondef(
    'public.process_successful_payment(text,jsonb,timestamptz)'::regprocedure
  ) INTO v_definition;

  v_start := strpos(v_definition, '  -- Retired AI subscriptions rejection');
  v_finish := strpos(v_definition, '  IF v_tx.purpose NOT IN');

  IF v_start = 0 OR v_finish = 0 OR v_finish <= v_start THEN
    RAISE EXCEPTION
      'LEARNER_AI_RETIREMENT_ABORTED: process_successful_payment markers changed';
  END IF;

  v_definition := substr(v_definition, 1, v_start - 1)
    || substr(v_definition, v_finish);

  IF v_definition ~* 'ai_subscription' THEN
    RAISE EXCEPTION
      'LEARNER_AI_RETIREMENT_ABORTED: process_successful_payment still references retired AI';
  END IF;

  EXECUTE v_definition;
END;
$rewrite_successful_payment$;

CREATE OR REPLACE FUNCTION public.process_unsuccessful_payment_callback(
  p_payment_transaction_id text,
  p_next_status text,
  p_provider_payload jsonb DEFAULT NULL,
  p_updated_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_effective_updated_at timestamptz := COALESCE(p_updated_at, now());
BEGIN
  IF p_next_status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'INVALID_UNSUCCESSFUL_PAYMENT_STATUS: %', p_next_status
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_TRANSACTION_NOT_FOUND: %', p_payment_transaction_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'transitioned', false,
      'status', v_tx.status,
      'transaction_id', v_tx.id
    );
  END IF;

  UPDATE public.payment_transactions
  SET status = p_next_status,
      provider_payload = COALESCE(p_provider_payload, provider_payload),
      updated_at = v_effective_updated_at
  WHERE id = p_payment_transaction_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'ok', true,
    'transitioned', true,
    'status', p_next_status,
    'transaction_id', v_tx.id
  );
END;
$$;

-- Remove triggers explicitly before their functions; do not use CASCADE.
DROP TRIGGER IF EXISTS trg_sync_ai_chat_session_message_count
  ON public.ai_conversations;
DROP TRIGGER IF EXISTS trg_guard_ai_chat_session_message_count
  ON public.ai_chat_sessions;
DROP TRIGGER IF EXISTS trg_guard_retired_ai_subscription_writes
  ON public.ai_subscriptions;
DROP TRIGGER IF EXISTS trg_guard_retired_ai_voucher_redemption_writes
  ON public.ai_voucher_redemptions;

DO $drop_retired_functions$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (n.nspname, p.proname) IN (
      ('private', 'sync_ai_chat_session_message_count'),
      ('public', 'guard_ai_chat_session_message_count'),
      ('public', 'guard_retired_ai_subscription_writes'),
      ('public', 'guard_retired_ai_voucher_redemption_writes'),
      ('public', 'match_knowledge_chunks'),
      ('public', 'record_ai_successful_usage'),
      ('public', 'reconcile_historical_ai_payment')
    )
  LOOP
    EXECUTE format('DROP FUNCTION %s', v_function);
  END LOOP;
END;
$drop_retired_functions$;

-- Drop child tables before their parents. Each DROP remains dependency-strict.
DROP TABLE public.ai_conversations;
DROP TABLE public.learning_observations;
DROP TABLE public.ai_voucher_redemptions;
DROP TABLE public.ai_vouchers;
DROP TABLE public.ai_voucher_batches;
DROP TABLE public.ai_chat_sessions;
DROP TABLE public.ai_subscriptions;
DROP TABLE public.ai_usage_daily;
DROP TABLE public.ai_usage_monthly;
DROP TABLE public.ai_usage_log;
DROP TABLE public.ai_model_pricing;
DROP TABLE public.knowledge_chunks;
DROP TABLE public.user_learning_profile;
DROP TABLE public.lesson_summaries;
DROP TABLE public.flashcard_decks;
DROP TABLE public.lesson_readiness_checks;
DROP TABLE public.learning_paths;

ALTER TABLE public.tier_limits
  DROP COLUMN monthly_messages,
  DROP COLUMN haiku_only,
  DROP COLUMN monthly_tokens,
  DROP COLUMN rolling_3h_tokens;

DO $verify_retirement$
DECLARE
  v_remaining text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
  INTO v_remaining
  FROM pg_tables
  WHERE schemaname IN ('public', 'private')
    AND tablename IN (
      'ai_chat_sessions', 'ai_conversations', 'ai_subscriptions',
      'ai_usage_daily', 'ai_usage_monthly', 'ai_usage_log',
      'ai_model_pricing', 'knowledge_chunks', 'user_learning_profile',
      'learning_observations', 'ai_voucher_batches', 'ai_vouchers',
      'ai_voucher_redemptions', 'lesson_summaries', 'flashcard_decks',
      'lesson_readiness_checks', 'learning_paths'
    );

  IF v_remaining IS NOT NULL THEN
    RAISE EXCEPTION 'LEARNER_AI_RETIREMENT_INCOMPLETE: %', v_remaining;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payment_transactions WHERE purpose = 'ai_subscription'
  ) THEN
    RAISE EXCEPTION 'LEARNER_AI_RETIREMENT_INCOMPLETE: AI payments remain';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tier_limits'
      AND column_name IN (
        'monthly_messages', 'haiku_only', 'monthly_tokens', 'rolling_3h_tokens'
      )
  ) THEN
    RAISE EXCEPTION 'LEARNER_AI_RETIREMENT_INCOMPLETE: AI quota columns remain';
  END IF;
END;
$verify_retirement$;
