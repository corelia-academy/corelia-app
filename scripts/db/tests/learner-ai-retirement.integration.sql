DO $test$
DECLARE
  v_remaining text;
  v_user_id uuid := gen_random_uuid();
BEGIN
  SELECT string_agg(c.relname, ', ')
  INTO v_remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'private')
    AND c.relname IN (
      'ai_chat_sessions', 'ai_conversations', 'ai_subscriptions',
      'ai_usage_daily', 'ai_usage_monthly', 'ai_usage_log',
      'ai_model_pricing', 'knowledge_chunks', 'user_learning_profile',
      'learning_observations', 'ai_voucher_batches', 'ai_vouchers',
      'ai_voucher_redemptions', 'lesson_summaries', 'flashcard_decks',
      'lesson_readiness_checks', 'learning_paths'
    );
  IF v_remaining IS NOT NULL THEN
    RAISE EXCEPTION 'Retired learner AI relations remain: %', v_remaining;
  END IF;

  IF to_regclass('public.tier_limits') IS NOT NULL
     OR to_regclass('public.dashboard_configs') IS NOT NULL THEN
    RAISE EXCEPTION 'Retired configuration relations remain';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'Unused vector extension remains installed';
  END IF;

  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'retirement-test@corelia.local');

  IF to_regclass('public.courses') IS NULL
     OR to_regclass('public.course_sections') IS NULL
     OR to_regclass('public.course_lessons') IS NULL
     OR to_regclass('public.course_section_questions') IS NULL THEN
    RAISE EXCEPTION 'Instructor course-authoring tables were removed';
  END IF;

  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$test$;
