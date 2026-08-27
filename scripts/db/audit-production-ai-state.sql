-- Comprehensive Read-Only Audit of Production AI State (Epic #332 / Issue #325)

WITH
sub_metrics AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'active' AND expires_at > now()) AS active_unexpired_subs,
    COUNT(*) FILTER (WHERE status = 'active' AND expires_at <= now()) AS active_expired_subs,
    COUNT(*) FILTER (WHERE status = 'expired') AS expired_subs,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_subs,
    COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_subs,
    COUNT(*) FILTER (WHERE status = 'superseded') AS superseded_subs,
    COUNT(*) AS total_subscriptions_count,
    MIN(started_at) AS earliest_sub_started_at,
    MAX(expires_at) AS latest_sub_expires_at
  FROM public.ai_subscriptions
),
tx_metrics AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'paid') AS paid_ai_tx_count,
    COALESCE(SUM(amount_vnd) FILTER (WHERE status = 'paid'), 0) AS paid_ai_gross_amount_vnd,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_ai_tx_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_ai_tx_count,
    COUNT(*) FILTER (WHERE status = 'refunded') AS refunded_ai_tx_count,
    COALESCE(SUM(amount_vnd) FILTER (WHERE status = 'refunded'), 0) AS refunded_ai_gross_amount_vnd,
    COUNT(*) AS total_ai_tx_count
  FROM public.payment_transactions
  WHERE purpose = 'ai_subscription'
),
voucher_metrics AS (
  SELECT
    (SELECT COUNT(*) FROM public.ai_voucher_batches) AS total_batches_count,
    (SELECT COUNT(*) FROM public.ai_vouchers) AS total_vouchers_count,
    (SELECT COUNT(*) FROM public.ai_vouchers WHERE active = true AND (ends_at IS NULL OR ends_at > now())) AS active_valid_vouchers_count,
    (SELECT COUNT(*) FROM public.ai_voucher_redemptions) AS total_redemptions_count,
    (SELECT COUNT(*) FROM public.ai_voucher_redemptions WHERE status = 'paid') AS paid_redemptions_count,
    (SELECT COUNT(*) FROM public.ai_voucher_redemptions WHERE status = 'reserved') AS reserved_redemptions_count,
    (SELECT COUNT(*) FROM public.ai_voucher_redemptions WHERE status = 'released') AS released_redemptions_count
),
usage_counts AS (
  SELECT
    (SELECT COUNT(*) FROM public.ai_chat_sessions) AS chat_sessions_count,
    (SELECT COUNT(*) FROM public.ai_conversations) AS conversations_count,
    (SELECT COUNT(*) FROM public.ai_usage_daily) AS usage_daily_count,
    (SELECT COUNT(*) FROM public.ai_usage_monthly) AS usage_monthly_count,
    (SELECT COUNT(*) FROM public.ai_usage_log) AS usage_log_count,
    (SELECT COUNT(*) FROM public.knowledge_chunks) AS knowledge_chunks_count,
    (SELECT COUNT(*) FROM public.user_learning_profile) AS user_learning_profile_count,
    (SELECT COUNT(*) FROM public.learning_observations) AS learning_observations_count,
    (SELECT COUNT(*) FROM public.lesson_summaries) AS lesson_summaries_count,
    (SELECT COUNT(*) FROM public.flashcard_decks) AS flashcard_decks_count,
    (SELECT COUNT(*) FROM public.lesson_readiness_checks) AS lesson_readiness_checks_count,
    (SELECT COUNT(*) FROM public.learning_paths) AS learning_paths_count
),
activity_timestamps AS (
  SELECT
    (SELECT MAX(last_message_at) FROM public.ai_chat_sessions) AS last_chat_session_activity_at,
    (SELECT MAX(created_at) FROM public.ai_conversations) AS last_conversation_created_at,
    (SELECT MAX(created_at) FROM public.ai_usage_log) AS last_usage_log_created_at,
    (SELECT MAX(updated_at) FROM public.ai_usage_daily) AS last_usage_daily_updated_at,
    (SELECT MAX(created_at) FROM public.lesson_summaries) AS last_lesson_summary_created_at,
    (SELECT MAX(created_at) FROM public.flashcard_decks) AS last_flashcard_deck_created_at,
    (SELECT MAX(created_at) FROM public.lesson_readiness_checks) AS last_readiness_check_created_at,
    (SELECT MAX(created_at) FROM public.learning_paths) AS last_learning_path_created_at,
    (SELECT MAX(created_at) FROM public.knowledge_chunks) AS last_knowledge_chunk_created_at
)
SELECT
  json_build_object(
    'subscriptions', (SELECT row_to_json(sub_metrics.*) FROM sub_metrics),
    'payments', (SELECT row_to_json(tx_metrics.*) FROM tx_metrics),
    'vouchers', (SELECT row_to_json(voucher_metrics.*) FROM voucher_metrics),
    'table_counts', (SELECT row_to_json(usage_counts.*) FROM usage_counts),
    'timestamps', (SELECT row_to_json(activity_timestamps.*) FROM activity_timestamps)
  ) AS production_audit_report;
