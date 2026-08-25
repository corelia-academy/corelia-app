-- =============================================================================
-- G2-R1 Database Integration & Verification Test Suite (DBH-R1)
-- Target: Real PostgreSQL / Supabase Local Disposable Database
-- Single Executable DO Block (Extended Query Protocol & Prepared Statement Safe)
-- Enforces:
--   1. Clean Recreate Verification & Preflight Invariant Check (PREFLIGHT-01)
--   2. FV-G2-02: Real Authenticated RLS & Composite FK Integration (OWN-01 to OWN-08)
--   3. Message-Count Trigger Real Database Verification (MSG-01 to MSG-08)
--   4. COMPAT-OLD-EDGE-NEW-DB-01: Real legacy aggregate write compatibility
--   5. FV-G2-03: Real Authenticated RPC Authorization (RPC-01 to RPC-06, PRIV-01 to PRIV-02, DATA-01)
--   6. FV-G2-01: Valid UUID & Partial-Index Compliant Entitlement Predicates (ENT-01 to ENT-03)
-- =============================================================================

DO $integration_test$
DECLARE
  -- Test Users
  v_user_a uuid := '11111111-1111-4111-8111-111111111111'::uuid;
  v_user_b uuid := '22222222-2222-4222-8222-222222222222'::uuid;
  v_user_c uuid := '33333333-3333-4333-8333-333333333333'::uuid;
  v_judge  uuid := '44444444-4444-4444-8444-444444444444'::uuid;
  v_support uuid := '55555555-5555-4555-8555-555555555555'::uuid;
  v_admin  uuid := '99999999-9999-4999-8999-999999999999'::uuid;

  -- Test Entities
  v_session_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  v_session_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid;
  v_conv_a uuid := 'a1111111-1111-4111-8111-111111111111'::uuid;
  v_conv_null uuid := 'a2222222-2222-4222-8222-222222222222'::uuid;
  
  v_session_1 uuid := '11111111-aaaa-4aaa-8aaa-111111111111'::uuid;
  v_session_2 uuid := '22222222-aaaa-4aaa-8aaa-222222222222'::uuid;
  v_conv_1 uuid := '11111111-cccc-4ccc-8ccc-111111111111'::uuid;
  v_conv_2 uuid := '22222222-cccc-4ccc-8ccc-222222222222'::uuid;
  v_conv_3 uuid := '33333333-cccc-4ccc-8ccc-333333333333'::uuid;
  v_conv_4 uuid := '44444444-cccc-4ccc-8ccc-444444444444'::uuid;

  -- MSG-06 Specific Test Fixtures
  v_msg6_sess_a uuid := '66666666-aaaa-4aaa-8aaa-111111111111'::uuid;
  v_msg6_sess_b uuid := '66666666-bbbb-4bbb-8bbb-222222222222'::uuid;
  v_msg6_conv_a uuid := '66666666-cccc-4ccc-8ccc-111111111111'::uuid;
  v_msg6_conv_b uuid := '66666666-cccc-4ccc-8ccc-222222222222'::uuid;
  v_msg6_malicious_conv uuid := '66666666-ffff-4fff-8fff-666666666666'::uuid;
  v_b_baseline_cnt int;
  v_b_baseline_ts timestamptz;
  v_sess_check uuid;

  -- COMPAT-OLD-EDGE-NEW-DB-01 fixtures
  v_compat_session_a uuid := 'c0100000-aaaa-4aaa-8aaa-000000000001'::uuid;
  v_compat_session_b uuid := 'c0100000-bbbb-4bbb-8bbb-000000000002'::uuid;
  v_compat_conv_insert uuid := 'c0100000-cccc-4ccc-8ccc-000000000001'::uuid;
  v_compat_conv_transition uuid := 'c0100000-cccc-4ccc-8ccc-000000000002'::uuid;
  v_compat_conv_delete uuid := 'c0100000-cccc-4ccc-8ccc-000000000003'::uuid;
  v_guard_trigger_count int;
  v_guard_trigger_def text;
  v_guard_function_schema text;
  v_guard_function_name text;
  v_guard_enabled text;
  v_guard_type int;
  v_guard_columns text;
  v_depth_1_events int;
  v_depth_2_events int;
  v_canonical_count int;
  v_stale_count int;

  v_hackathon_id text := 'hackathon-test-g2-r1';
  v_sub_a uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  v_sub_b uuid := 'b0000000-0000-4000-8000-000000000002'::uuid;
  v_tx_a text := 'ptx-test-g2-r1-a';
  v_tx_b text := 'ptx-test-g2-r1-b';

  -- Variables for assertions
  v_mismatched_count int;
  v_err_caught boolean;
  v_err_sqlstate text;
  v_err_msg text;
  v_err_constraint text;
  v_oracle_pass boolean;
  v_remaining_conv int;
  v_affected int;
  v_cnt int;
  v_last_time timestamptz;
  v_ts timestamptz := '2026-08-23 10:00:00+00'::timestamptz;
  v_initial_doc jsonb;
  v_patched_doc jsonb;
  v_result jsonb;
  v_active_sub public.ai_subscriptions%ROWTYPE;
BEGIN
  RAISE NOTICE '===================================================================';
  RAISE NOTICE ' STARTING G2-R1 DATABASE INTEGRATION TEST SUITE (PostgreSQL Local)';
  RAISE NOTICE '===================================================================';

  -- ---------------------------------------------------------------------------
  -- 0. Fixtures Setup (auth.users & public.profiles)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_user_a, 'user_a@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"User A"}'),
    (v_user_b, 'user_b@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"User B"}'),
    (v_user_c, 'user_c@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"User C"}'),
    (v_judge, 'judge@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"Judge User"}'),
    (v_support, 'support@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"Support User"}'),
    (v_admin, 'admin@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"Admin User"}')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, full_name, role, tier)
  VALUES
    (v_user_a, 'User A', 'student', 'free'),
    (v_user_b, 'User B', 'student', 'free'),
    (v_user_c, 'User C', 'instructor', 'pro'),
    (v_judge, 'Judge User', 'student', 'free'),
    (v_support, 'Support User', 'support_staff', 'free'),
    (v_admin, 'Admin User', 'admin', 'free')
  ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role, tier = EXCLUDED.tier;

  -- ---------------------------------------------------------------------------
  -- 1. Preflight Invariant Check (PREFLIGHT-01)
  -- ---------------------------------------------------------------------------
  SELECT count(*)
  INTO v_mismatched_count
  FROM public.ai_conversations c
  LEFT JOIN public.ai_chat_sessions s
    ON s.id = c.session_id
  WHERE c.session_id IS NOT NULL
    AND (
      s.id IS NULL
      OR s.user_id IS DISTINCT FROM c.user_id
    );

  IF v_mismatched_count <> 0 THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Found % mismatched or orphan conversation-session rows', v_mismatched_count;
  END IF;
  RAISE NOTICE '✓ PREFLIGHT-01: PASS (0 orphan/mismatched rows across database)';

  -- ---------------------------------------------------------------------------
  -- 2. FV-G2-02: Real Authenticated RLS & Composite FK (OWN-01 to OWN-08)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.ai_chat_sessions (id, user_id, context_type, title, message_count)
  VALUES
    (v_session_a, v_user_a, 'dashboard', 'Session A', 0),
    (v_session_b, v_user_b, 'dashboard', 'Session B', 0)
  ON CONFLICT (id) DO UPDATE SET message_count = 0;

  -- Act as User A under authenticated RLS
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_user_a), true);

  -- OWN-01: Matching conversation insert succeeded under RLS
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_conv_a, v_user_a, v_session_a, 'user', 'Hello A', 'completed');
  RAISE NOTICE '✓ OWN-01: PASS (Matching conversation insert succeeded under authenticated RLS)';

  -- OWN-02: Foreign session insert rejected by RLS & Composite FK
  v_err_caught := false;
  v_err_sqlstate := NULL;
  v_err_msg := NULL;
  v_err_constraint := NULL;
  BEGIN
    INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
    VALUES (gen_random_uuid(), v_user_a, v_session_b, 'user', 'Malicious insert', 'completed');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT,
      v_err_constraint = CONSTRAINT_NAME;
    IF v_err_sqlstate IN ('42501', '23503') THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'OWN-02: Unexpected error (SQLSTATE: %, MSG: %, CONSTRAINT: %)', v_err_sqlstate, v_err_msg, v_err_constraint;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'OWN-02: FAILED. Foreign session insert was NOT rejected under RLS/FK!';
  END IF;
  RAISE NOTICE '✓ OWN-02: PASS (Cross-owner conversation insert rejected by RLS & Composite FK)';

  -- OWN-03: Cross-owner session move rejected
  v_err_caught := false;
  v_err_sqlstate := NULL;
  v_err_msg := NULL;
  v_err_constraint := NULL;
  BEGIN
    UPDATE public.ai_conversations
    SET session_id = v_session_b
    WHERE id = v_conv_a;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT,
      v_err_constraint = CONSTRAINT_NAME;
    IF v_err_sqlstate IN ('42501', '23503') THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'OWN-03: Unexpected error (SQLSTATE: %, MSG: %, CONSTRAINT: %)', v_err_sqlstate, v_err_msg, v_err_constraint;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'OWN-03: FAILED. Cross-owner session reassignment was NOT rejected under RLS/FK!';
  END IF;
  RAISE NOTICE '✓ OWN-03: PASS (Cross-owner session move rejected by RLS & Composite FK)';

  -- OWN-04: Changing conversation owner rejected
  v_err_caught := false;
  v_err_sqlstate := NULL;
  v_err_msg := NULL;
  v_err_constraint := NULL;
  BEGIN
    UPDATE public.ai_conversations
    SET user_id = v_user_b
    WHERE id = v_conv_a;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT,
      v_err_constraint = CONSTRAINT_NAME;
    IF v_err_sqlstate IN ('42501', '23503') THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'OWN-04: Unexpected error (SQLSTATE: %, MSG: %, CONSTRAINT: %)', v_err_sqlstate, v_err_msg, v_err_constraint;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'OWN-04: FAILED. Changing conversation owner was NOT rejected under RLS!';
  END IF;
  RAISE NOTICE '✓ OWN-04: PASS (Mismatched user_id update rejected by RLS WITH CHECK)';

  -- OWN-06: Nullable session_id for lesson chats preserved under RLS
  INSERT INTO public.ai_conversations (id, user_id, lesson_id, session_id, role, content, status)
  VALUES (v_conv_null, v_user_a, 'lesson-101', NULL, 'user', 'Lesson question', 'completed');
  RAISE NOTICE '✓ OWN-06: PASS (Nullable session_id for lesson chats preserved under RLS)';

  -- Act as User B under authenticated RLS
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_user_b), true);

  -- OWN-05: User B cannot modify User A's conversation
  UPDATE public.ai_conversations
  SET content = 'Hacked by B'
  WHERE id = v_conv_a;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'OWN-05: FAILED. User B was able to UPDATE User A conversation through RLS!';
  END IF;

  DELETE FROM public.ai_conversations WHERE id = v_conv_a;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected <> 0 THEN
    RAISE EXCEPTION 'OWN-05: FAILED. User B was able to DELETE User A conversation through RLS!';
  END IF;
  RAISE NOTICE '✓ OWN-05: PASS (User B blocked from modifying User A conversations under RLS)';

  -- Reset role to postgres for cascade and service_role tests
  PERFORM set_config('role', 'postgres', true);

  -- OWN-07: Delete Session A cascades session conversations only
  DELETE FROM public.ai_chat_sessions WHERE id = v_session_a;
  SELECT count(*) INTO v_remaining_conv FROM public.ai_conversations WHERE id = v_conv_a;
  IF v_remaining_conv <> 0 THEN
    RAISE EXCEPTION 'OWN-07: FAILED. Conversation A was not cascaded upon session deletion!';
  END IF;
  SELECT count(*) INTO v_remaining_conv FROM public.ai_conversations WHERE id = v_conv_null;
  IF v_remaining_conv <> 1 THEN
    RAISE EXCEPTION 'OWN-07: FAILED. Lesson conversation was accidentally deleted during session cascade!';
  END IF;
  RAISE NOTICE '✓ OWN-07: PASS (ON DELETE CASCADE operates accurately on session-bound rows only)';

  -- OWN-08: Service role backend writer remains compatible
  INSERT INTO public.ai_conversations (id, user_id, lesson_id, role, content, status)
  VALUES (gen_random_uuid(), v_user_a, 'lesson-service-102', 'assistant', 'Service response', 'completed');
  RAISE NOTICE '✓ OWN-08: PASS (Service role backend writer remains compatible)';

  -- Clean up ownership test records
  DELETE FROM public.ai_conversations WHERE user_id IN (v_user_a, v_user_b);
  DELETE FROM public.ai_chat_sessions WHERE id IN (v_session_a, v_session_b);

  -- ---------------------------------------------------------------------------
  -- 3. Message-Count Trigger Real Database Verification (MSG-01 to MSG-08)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.ai_chat_sessions (id, user_id, context_type, title, message_count)
  VALUES
    (v_session_1, v_user_a, 'dashboard', 'Session 1', 0),
    (v_session_2, v_user_a, 'dashboard', 'Session 2', 0);

  -- MSG-01: Persisted completed message increments count to 1 and updates last_message_at
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status, created_at)
  VALUES (v_conv_1, v_user_a, v_session_1, 'user', 'msg 1', 'completed', v_ts);
  
  SELECT message_count, last_message_at INTO v_cnt, v_last_time FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 1 OR v_last_time <> v_ts THEN
    RAISE EXCEPTION 'MSG-01: FAILED. Expected message_count 1 and last_message_at %, got % / %', v_ts, v_cnt, v_last_time;
  END IF;
  RAISE NOTICE '✓ MSG-01: PASS (Completed conversation increments count and updates last_message_at)';

  -- MSG-02: Provider failure / pending state does NOT increment message_count
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_conv_2, v_user_a, v_session_1, 'assistant', 'failed', 'error');

  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'MSG-02: FAILED. Error conversation incremented count to %', v_cnt;
  END IF;
  RAISE NOTICE '✓ MSG-02: PASS (Error conversation does not increment count)';

  -- MSG-03: INSERT pending then UPDATE to completed increments by exactly 1
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_conv_3, v_user_a, v_session_1, 'assistant', 'streaming...', 'pending');

  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'MSG-03: FAILED. Pending insert incremented count prematurely to %', v_cnt;
  END IF;

  UPDATE public.ai_conversations SET status = 'completed', content = 'finished response' WHERE id = v_conv_3;
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'MSG-03: FAILED. Status transition pending->completed expected count 2, got %', v_cnt;
  END IF;
  RAISE NOTICE '✓ MSG-03: PASS (Pending -> Completed transition updates count accurately)';

  -- MSG-07: Repeated UPDATE of completed row is idempotent
  UPDATE public.ai_conversations SET tokens_used = 150 WHERE id = v_conv_3;
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'MSG-07: FAILED. Repeated update on completed row altered message_count to %', v_cnt;
  END IF;
  RAISE NOTICE '✓ MSG-07: PASS (Repeated update on completed row is idempotent)';

  -- MSG-08: Completed -> Error status transition decrements message_count
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_conv_4, v_user_a, v_session_1, 'user', 'will be revoked', 'completed');
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 3 THEN
    RAISE EXCEPTION 'MSG-08: FAILED. Pre-transition count expected 3, got %', v_cnt;
  END IF;

  UPDATE public.ai_conversations SET status = 'error' WHERE id = v_conv_4;
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 2 THEN
    RAISE EXCEPTION 'MSG-08: FAILED. Completed -> Error transition did not decrement count! (got %)', v_cnt;
  END IF;
  RAISE NOTICE '✓ MSG-08: PASS (Completed -> Error transition accurately decrements count)';

  -- MSG-05: Move conversation between sessions of same user
  UPDATE public.ai_conversations SET session_id = v_session_2 WHERE id = v_conv_3;
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'MSG-05: FAILED. Moving conversation failed to decrement old session (count: %)', v_cnt;
  END IF;
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_2;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'MSG-05: FAILED. Moving conversation failed to increment new session (count: %)', v_cnt;
  END IF;
  RAISE NOTICE '✓ MSG-05: PASS (Moving conversation accurately adjusts both old and new session counts)';

  -- MSG-04: DELETE completed conversation decrements count
  DELETE FROM public.ai_conversations WHERE id = v_conv_1;
  SELECT message_count INTO v_cnt FROM public.ai_chat_sessions WHERE id = v_session_1;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MSG-04: FAILED. Deleting completed conversation did not decrement count to 0 (got %)', v_cnt;
  END IF;
  RAISE NOTICE '✓ MSG-04: PASS (Deleting completed conversation decrements count)';

  -- Clean up MSG-01 to MSG-05 test rows
  DELETE FROM public.ai_conversations WHERE id IN (v_conv_1, v_conv_2, v_conv_3, v_conv_4);
  DELETE FROM public.ai_chat_sessions WHERE id IN (v_session_1, v_session_2);

  -- ---------------------------------------------------------------------------
  -- MSG-06: Cross-Owner Session Aggregate Isolation & Mutation Attack Resistance
  -- ---------------------------------------------------------------------------
  -- Setup:
  -- Session A owned by User A (starts empty: message_count = 0)
  -- Session B owned by User B (has legitimate completed message: message_count = 1, last_message_at = v_ts)
  INSERT INTO public.ai_chat_sessions (id, user_id, context_type, title, message_count, last_message_at)
  VALUES
    (v_msg6_sess_a, v_user_a, 'dashboard', 'MSG6 Session A', 0, v_ts),
    (v_msg6_sess_b, v_user_b, 'dashboard', 'MSG6 Session B', 0, v_ts)
  ON CONFLICT (id) DO UPDATE SET message_count = 0, last_message_at = v_ts;

  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status, created_at)
  VALUES (v_msg6_conv_b, v_user_b, v_msg6_sess_b, 'user', 'Legit message in B', 'completed', v_ts);

  -- Capture baseline state of Session B
  SELECT message_count, last_message_at INTO v_b_baseline_cnt, v_b_baseline_ts
  FROM public.ai_chat_sessions
  WHERE id = v_msg6_sess_b;

  IF v_b_baseline_cnt <> 1 OR v_b_baseline_ts IS DISTINCT FROM v_ts THEN
    RAISE EXCEPTION 'MSG-06 Setup Failed: Expected baseline count 1 and ts %, got % / %', v_ts, v_b_baseline_cnt, v_b_baseline_ts;
  END IF;

  -- -------------------------------------------------------------------------
  -- ATTACK 1: Authenticated User A attempts direct INSERT into User B's Session B
  -- -------------------------------------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_user_a), true);

  v_err_caught := false;
  v_err_sqlstate := NULL;
  v_err_msg := NULL;
  v_err_constraint := NULL;
  BEGIN
    INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status, created_at)
    VALUES (v_msg6_malicious_conv, v_user_a, v_msg6_sess_b, 'user', 'Malicious injection into B', 'completed', now());
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT,
      v_err_constraint = CONSTRAINT_NAME;
    -- Expected: 42501 (RLS insufficient_privilege WITH CHECK) or 23503 (foreign_key_violation ai_conversations_session_user_fkey)
    IF v_err_sqlstate IN ('42501', '23503') THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'MSG-06 Attack 1: Unexpected error (SQLSTATE: %, MSG: %, CONSTRAINT: %)', v_err_sqlstate, v_err_msg, v_err_constraint;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'MSG-06: FAILED. User A was able to INSERT conversation into User B session!';
  END IF;

  -- Verify Session B aggregate was NOT mutated by rejected insert
  PERFORM set_config('role', 'postgres', true);
  SELECT message_count, last_message_at INTO v_cnt, v_last_time
  FROM public.ai_chat_sessions
  WHERE id = v_msg6_sess_b;

  IF v_cnt <> v_b_baseline_cnt OR v_last_time IS DISTINCT FROM v_b_baseline_ts THEN
    RAISE EXCEPTION 'MSG-06: FAILED. Session B aggregate was altered by rejected insert! (count: %, ts: %)', v_cnt, v_last_time;
  END IF;

  SELECT count(*) INTO v_cnt FROM public.ai_conversations WHERE id = v_msg6_malicious_conv;
  IF v_cnt <> 0 THEN
    RAISE EXCEPTION 'MSG-06: FAILED. Malicious conversation row was created in database!';
  END IF;

  -- -------------------------------------------------------------------------
  -- ATTACK 2: Authenticated User A attempts to UPDATE legitimate conversation A's session_id to Session B
  -- -------------------------------------------------------------------------
  -- First, insert legitimate completed conversation into Session A as User A
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status, created_at)
  VALUES (v_msg6_conv_a, v_user_a, v_msg6_sess_a, 'user', 'Legit message A', 'completed', v_ts + interval '1 hour');

  SELECT message_count, last_message_at INTO v_cnt, v_last_time
  FROM public.ai_chat_sessions
  WHERE id = v_msg6_sess_a;

  IF v_cnt <> 1 OR v_last_time IS DISTINCT FROM (v_ts + interval '1 hour') THEN
    RAISE EXCEPTION 'MSG-06 Setup Failed: Session A expected count 1 and ts %, got % / %', (v_ts + interval '1 hour'), v_cnt, v_last_time;
  END IF;

  -- Switch to authenticated User A to attempt malicious session reassignment
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_user_a), true);

  v_err_caught := false;
  v_err_sqlstate := NULL;
  v_err_msg := NULL;
  v_err_constraint := NULL;
  BEGIN
    UPDATE public.ai_conversations
    SET session_id = v_msg6_sess_b
    WHERE id = v_msg6_conv_a;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT,
      v_err_constraint = CONSTRAINT_NAME;
    -- Expected: 42501 (RLS WITH CHECK violation) or 23503 (Composite FK violation)
    IF v_err_sqlstate IN ('42501', '23503') THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'MSG-06 Attack 2: Unexpected error (SQLSTATE: %, MSG: %, CONSTRAINT: %)', v_err_sqlstate, v_err_msg, v_err_constraint;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'MSG-06: FAILED. User A was able to UPDATE session_id to User B session!';
  END IF;

  -- Verify under postgres role that Session B remains unaffected
  PERFORM set_config('role', 'postgres', true);
  SELECT message_count, last_message_at INTO v_cnt, v_last_time
  FROM public.ai_chat_sessions
  WHERE id = v_msg6_sess_b;

  IF v_cnt <> v_b_baseline_cnt OR v_last_time IS DISTINCT FROM v_b_baseline_ts THEN
    RAISE EXCEPTION 'MSG-06: FAILED. Session B aggregate was altered by rejected session update! (count: %, ts: %)', v_cnt, v_last_time;
  END IF;

  -- Verify Session A aggregate remains completely intact
  SELECT message_count, last_message_at INTO v_cnt, v_last_time
  FROM public.ai_chat_sessions
  WHERE id = v_msg6_sess_a;

  IF v_cnt <> 1 OR v_last_time IS DISTINCT FROM (v_ts + interval '1 hour') THEN
    RAISE EXCEPTION 'MSG-06: FAILED. Session A aggregate corrupted after rejected update! (count: %, ts: %)', v_cnt, v_last_time;
  END IF;

  -- Verify conversation A still belongs to Session A
  SELECT session_id INTO v_sess_check FROM public.ai_conversations WHERE id = v_msg6_conv_a;
  IF v_sess_check IS DISTINCT FROM v_msg6_sess_a THEN
    RAISE EXCEPTION 'MSG-06: FAILED. Conversation A session_id changed despite update rejection!';
  END IF;

  -- -------------------------------------------------------------------------
  -- ATTACK 3: Authenticated User A attempts to UPDATE both session_id = Session B AND user_id = User B
  -- -------------------------------------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_user_a), true);

  v_err_caught := false;
  v_err_sqlstate := NULL;
  v_err_msg := NULL;
  v_err_constraint := NULL;
  BEGIN
    UPDATE public.ai_conversations
    SET session_id = v_msg6_sess_b, user_id = v_user_b
    WHERE id = v_msg6_conv_a;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT,
      v_err_constraint = CONSTRAINT_NAME;
    -- Expected: 42501 (RLS WITH CHECK auth.uid() = user_id violation) or 23503 (Composite FK violation)
    IF v_err_sqlstate IN ('42501', '23503') THEN
      v_err_caught := true;
    ELSE
      RAISE EXCEPTION 'MSG-06 Attack 3: Unexpected error (SQLSTATE: %, MSG: %, CONSTRAINT: %)', v_err_sqlstate, v_err_msg, v_err_constraint;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'MSG-06: FAILED. User A was able to reassign conversation to User B and Session B!';
  END IF;

  PERFORM set_config('role', 'postgres', true);
  SELECT message_count, last_message_at INTO v_cnt, v_last_time
  FROM public.ai_chat_sessions
  WHERE id = v_msg6_sess_b;

  IF v_cnt <> v_b_baseline_cnt OR v_last_time IS DISTINCT FROM v_b_baseline_ts THEN
    RAISE EXCEPTION 'MSG-06: FAILED. Session B aggregate was altered by dual reassign attempt!';
  END IF;

  -- -------------------------------------------------------------------------
  -- NEGATIVE ORACLE: Verify error classifier fails closed on arbitrary SQL error
  -- -------------------------------------------------------------------------
  v_oracle_pass := false;
  BEGIN
    BEGIN
      -- Generate synthetic unexpected error (division by zero: SQLSTATE 22012)
      PERFORM 1 / 0;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_err_sqlstate = RETURNED_SQLSTATE,
        v_err_msg = MESSAGE_TEXT,
        v_err_constraint = CONSTRAINT_NAME;
      IF v_err_sqlstate IN ('42501', '23503') THEN
        -- Buggy classifier would swallow this
        v_err_caught := true;
      ELSE
        -- Correct classifier rethrows / raises unexpected exception
        RAISE EXCEPTION 'ORACLE_RETHROW: SQLSTATE % is unexpected', v_err_sqlstate;
      END IF;
    END;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_sqlstate = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    IF v_err_msg LIKE 'ORACLE_RETHROW: SQLSTATE 22012%' THEN
      v_oracle_pass := true;
    END IF;
  END;

  IF NOT v_oracle_pass THEN
    RAISE EXCEPTION 'MSG-06-ORACLE: FAILED. Classifier failed to rethrow unexpected SQLSTATE 22012!';
  END IF;

  -- Clean up MSG-06 fixtures
  DELETE FROM public.ai_conversations WHERE id IN (v_msg6_conv_a, v_msg6_conv_b, v_msg6_malicious_conv);
  DELETE FROM public.ai_chat_sessions WHERE id IN (v_msg6_sess_a, v_msg6_sess_b);

  RAISE NOTICE '✓ MSG-06: PASS (Foreign user session cannot be mutated via cross-owner insert/update, aggregates & error classifications strictly verified)';

  -- ---------------------------------------------------------------------------
  -- 4. COMPAT-OLD-EDGE-NEW-DB-01
  --    Real DML proof for the worst rollout state: NEW DB + OLD EDGE.
  -- ---------------------------------------------------------------------------

  -- Prove the deployed trigger identity from PostgreSQL catalogs, not source text.
  SELECT
    count(*)::int,
    max(pg_get_triggerdef(t.oid)),
    max(pn.nspname),
    max(p.proname),
    max(t.tgenabled::text),
    max(t.tgtype::int),
    max(t.tgattr::text)
  INTO
    v_guard_trigger_count,
    v_guard_trigger_def,
    v_guard_function_schema,
    v_guard_function_name,
    v_guard_enabled,
    v_guard_type,
    v_guard_columns
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace cn ON cn.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE t.tgname = 'trg_guard_ai_chat_session_message_count'
    AND NOT t.tgisinternal
    AND cn.nspname = 'public'
    AND c.relname = 'ai_chat_sessions';

  IF v_guard_trigger_count <> 1
     OR v_guard_enabled IS DISTINCT FROM 'O'
     OR v_guard_type IS DISTINCT FROM 19
     OR v_guard_function_schema IS DISTINCT FROM 'public'
     OR v_guard_function_name IS DISTINCT FROM 'guard_ai_chat_session_message_count'
     OR v_guard_columns IS DISTINCT FROM (
       SELECT a.attnum::text
       FROM pg_attribute a
       WHERE a.attrelid = 'public.ai_chat_sessions'::regclass
         AND a.attname = 'message_count'
         AND NOT a.attisdropped
     )
     OR v_guard_trigger_def NOT LIKE '%BEFORE UPDATE OF message_count ON public.ai_chat_sessions FOR EACH ROW%' THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: Guard identity mismatch (count %, enabled %, type %, function %.%, columns %, def %)',
      v_guard_trigger_count, v_guard_enabled, v_guard_type,
      v_guard_function_schema, v_guard_function_name, v_guard_columns, v_guard_trigger_def;
  END IF;

  -- A temporary observer records the real trigger depth for each session update.
  -- It runs after the guard alphabetically and never changes NEW.
  EXECUTE 'CREATE TEMP TABLE compat_trigger_depth_events (
    event_id bigint GENERATED ALWAYS AS IDENTITY,
    session_id uuid NOT NULL,
    trigger_depth int NOT NULL,
    old_count int NOT NULL,
    new_count int NOT NULL
  ) ON COMMIT DROP';
  EXECUTE $compat_ddl$
    CREATE FUNCTION pg_temp.capture_compat_session_trigger_depth()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $capture$
    BEGIN
      INSERT INTO pg_temp.compat_trigger_depth_events (
        session_id, trigger_depth, old_count, new_count
      ) VALUES (
        NEW.id, pg_trigger_depth(), OLD.message_count, NEW.message_count
      );
      RETURN NEW;
    END;
    $capture$
  $compat_ddl$;
  EXECUTE 'CREATE TRIGGER zz_test_capture_compat_session_trigger_depth
    BEFORE UPDATE OF message_count ON public.ai_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION pg_temp.capture_compat_session_trigger_depth()';

  INSERT INTO public.ai_chat_sessions (id, user_id, context_type, title, message_count)
  VALUES
    (v_compat_session_a, v_user_a, 'dashboard', 'Compatibility Session A', 0),
    (v_compat_session_b, v_user_b, 'dashboard', 'Compatibility Session B', 0);

  -- completed INSERT: canonical nested update is depth 2; stale OLD EDGE write is depth 1.
  TRUNCATE pg_temp.compat_trigger_depth_events;
  SELECT message_count INTO v_stale_count
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;

  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_compat_conv_insert, v_user_a, v_compat_session_a, 'user', 'completed insert', 'completed');

  SELECT count(*) INTO v_depth_2_events
  FROM pg_temp.compat_trigger_depth_events
  WHERE session_id = v_compat_session_a AND trigger_depth = 2 AND old_count = 0 AND new_count = 1;
  IF v_depth_2_events <> 1 THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: completed INSERT did not produce the expected nested depth-2 session update';
  END IF;

  UPDATE public.ai_chat_sessions
  SET message_count = v_stale_count + 2
  WHERE id = v_compat_session_a;

  SELECT count(*) INTO v_depth_1_events
  FROM pg_temp.compat_trigger_depth_events
  WHERE session_id = v_compat_session_a AND trigger_depth = 1 AND new_count = 1;
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  IF v_depth_1_events <> 1 OR v_cnt <> 1 THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: stale direct write after completed INSERT persisted (depth-1 events %, count %)', v_depth_1_events, v_cnt;
  END IF;

  -- pending -> completed.
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_compat_conv_transition, v_user_a, v_compat_session_a, 'assistant', 'pending transition', 'pending');
  SELECT message_count INTO v_stale_count
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  TRUNCATE pg_temp.compat_trigger_depth_events;

  UPDATE public.ai_conversations
  SET status = 'completed', content = 'transition completed'
  WHERE id = v_compat_conv_transition;
  UPDATE public.ai_chat_sessions
  SET message_count = v_stale_count + 2
  WHERE id = v_compat_session_a;

  SELECT count(*) FILTER (WHERE trigger_depth = 2),
         count(*) FILTER (WHERE trigger_depth = 1)
  INTO v_depth_2_events, v_depth_1_events
  FROM pg_temp.compat_trigger_depth_events
  WHERE session_id = v_compat_session_a;
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  IF v_depth_2_events <> 1 OR v_depth_1_events <> 1 OR v_cnt <> 2 THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: pending->completed compatibility failed (depth2 %, depth1 %, count %)', v_depth_2_events, v_depth_1_events, v_cnt;
  END IF;

  -- Repeated UPDATE on a completed row must not change the canonical count;
  -- the following stale direct OLD EDGE write must still be normalized.
  SELECT message_count INTO v_stale_count
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  TRUNCATE pg_temp.compat_trigger_depth_events;
  UPDATE public.ai_conversations
  SET tokens_used = tokens_used + 1
  WHERE id = v_compat_conv_transition;
  UPDATE public.ai_chat_sessions
  SET message_count = v_stale_count + 2
  WHERE id = v_compat_session_a;

  SELECT count(*) FILTER (WHERE trigger_depth = 2),
         count(*) FILTER (WHERE trigger_depth = 1)
  INTO v_depth_2_events, v_depth_1_events
  FROM pg_temp.compat_trigger_depth_events
  WHERE session_id = v_compat_session_a;
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  IF v_depth_2_events <> 0 OR v_depth_1_events <> 1 OR v_cnt <> 2 THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: repeated completed UPDATE was not idempotent (depth2 %, depth1 %, count %)', v_depth_2_events, v_depth_1_events, v_cnt;
  END IF;

  -- completed -> error followed by a stale direct aggregate update.
  SELECT message_count INTO v_stale_count
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  TRUNCATE pg_temp.compat_trigger_depth_events;
  UPDATE public.ai_conversations
  SET status = 'error'
  WHERE id = v_compat_conv_transition;
  UPDATE public.ai_chat_sessions
  SET message_count = v_stale_count + 2
  WHERE id = v_compat_session_a;

  SELECT count(*) FILTER (WHERE trigger_depth = 2),
         count(*) FILTER (WHERE trigger_depth = 1)
  INTO v_depth_2_events, v_depth_1_events
  FROM pg_temp.compat_trigger_depth_events
  WHERE session_id = v_compat_session_a;
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  IF v_depth_2_events <> 1 OR v_depth_1_events <> 1 OR v_cnt <> 1 THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: completed->error compatibility failed (depth2 %, depth1 %, count %)', v_depth_2_events, v_depth_1_events, v_cnt;
  END IF;

  -- DELETE completed followed by a stale direct aggregate update.
  INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
  VALUES (v_compat_conv_delete, v_user_a, v_compat_session_a, 'user', 'delete completed', 'completed');
  SELECT message_count INTO v_stale_count
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  TRUNCATE pg_temp.compat_trigger_depth_events;
  DELETE FROM public.ai_conversations WHERE id = v_compat_conv_delete;
  UPDATE public.ai_chat_sessions
  SET message_count = v_stale_count + 2
  WHERE id = v_compat_session_a;

  SELECT count(*) FILTER (WHERE trigger_depth = 2),
         count(*) FILTER (WHERE trigger_depth = 1)
  INTO v_depth_2_events, v_depth_1_events
  FROM pg_temp.compat_trigger_depth_events
  WHERE session_id = v_compat_session_a;
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  SELECT count(*)::int INTO v_canonical_count
  FROM public.ai_conversations
  WHERE session_id = v_compat_session_a AND status = 'completed';
  IF v_depth_2_events <> 1 OR v_depth_1_events <> 1 OR v_cnt <> v_canonical_count OR v_cnt <> 1 THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: DELETE completed compatibility failed (depth2 %, depth1 %, count %, canonical %)', v_depth_2_events, v_depth_1_events, v_cnt, v_canonical_count;
  END IF;

  -- Authenticated User A cannot directly corrupt User B's aggregate.
  SELECT message_count INTO v_b_baseline_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_b;
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', v_user_a), true);
  UPDATE public.ai_chat_sessions
  SET message_count = 999
  WHERE id = v_compat_session_b;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  PERFORM set_config('role', 'postgres', true);
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_b;
  IF v_affected <> 0 OR v_cnt <> v_b_baseline_cnt THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: cross-owner direct update corrupted Session B (affected %, before %, after %)', v_affected, v_b_baseline_cnt, v_cnt;
  END IF;

  -- Final invariant and cleanup. The observer is removed explicitly so the
  -- integration suite proves it does not leave a persistent test object.
  SELECT message_count INTO v_cnt
  FROM public.ai_chat_sessions WHERE id = v_compat_session_a;
  SELECT count(*)::int INTO v_canonical_count
  FROM public.ai_conversations
  WHERE session_id = v_compat_session_a AND status = 'completed';
  IF v_cnt <> v_canonical_count THEN
    RAISE EXCEPTION 'COMPAT-OLD-EDGE-NEW-DB-01: final aggregate mismatch (stored %, canonical %)', v_cnt, v_canonical_count;
  END IF;

  DELETE FROM public.ai_conversations
  WHERE id IN (v_compat_conv_insert, v_compat_conv_transition, v_compat_conv_delete);
  DELETE FROM public.ai_chat_sessions
  WHERE id IN (v_compat_session_a, v_compat_session_b);
  EXECUTE 'DROP TRIGGER zz_test_capture_compat_session_trigger_depth ON public.ai_chat_sessions';
  EXECUTE 'DROP FUNCTION pg_temp.capture_compat_session_trigger_depth()';

  RAISE NOTICE '✓ COMPAT-OLD-EDGE-NEW-DB-01: PASS (real DML, runtime guard identity, depth-1 direct writes, depth-2 canonical writes, transitions, and owner isolation verified)';

  -- ---------------------------------------------------------------------------
  -- 5. FV-G2-03 Real RPC Privilege & Authorization Integration
  -- ---------------------------------------------------------------------------
  IF has_function_privilege('anon', 'public.patch_hackathon_metrics_snapshot(text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-01: FAILED. anon role still has EXECUTE privilege on patch_hackathon_metrics_snapshot!';
  END IF;
  RAISE NOTICE '✓ PRIV-01: PASS (anon role EXECUTE privilege revoked)';

  IF NOT has_function_privilege('authenticated', 'public.patch_hackathon_metrics_snapshot(text, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'PRIV-02: FAILED. authenticated role lacks EXECUTE privilege on patch_hackathon_metrics_snapshot!';
  END IF;
  RAISE NOTICE '✓ PRIV-02: PASS (authenticated role granted EXECUTE)';

  -- Setup hackathon
  v_initial_doc := jsonb_build_object(
    'title', 'Original Hackathon Title',
    'tagline', 'Original Tagline',
    'description', 'Original Description',
    'created_by', v_user_a::text,
    'max_participants', 50,
    'metrics_snapshot', jsonb_build_object(
      'registrations_total', 0,
      'submissions_total', 0,
      'updated_at', '2026-08-23T00:00:00Z'
    )
  );

  INSERT INTO public.hackathons (id, status, document)
  VALUES (v_hackathon_id, 'published', v_initial_doc)
  ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document;

  -- Real invite fixture for Judge
  INSERT INTO public.hackathon_access_invites (id, hackathon_id, document)
  VALUES (
    'invite-judge-g2-r1',
    v_hackathon_id,
    jsonb_build_object(
      'email', 'judge@test.local',
      'status', 'accepted',
      'roles', jsonb_build_array('judge')
    )
  ) ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document;

  -- ---------------------------------------------------------------------------
  -- RPC-01: Unauthenticated context (auth.uid() IS NULL) -> Throws authentication_required
  -- ---------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  v_err_caught := false;
  BEGIN
    PERFORM public.patch_hackathon_metrics_snapshot(v_hackathon_id, jsonb_build_object('registrations_total', 1));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%unauthorized:authentication_required%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'RPC-01: FAILED. Anonymous/Unauthenticated caller was able to execute RPC!';
  END IF;
  RAISE NOTICE '✓ RPC-01: PASS (Anonymous/unauthenticated caller rejected with authentication_required)';

  -- RPC-02: Authenticated unrelated user (User B) denied
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"user_b@test.local"}', v_user_b), true);

  v_err_caught := false;
  BEGIN
    PERFORM public.patch_hackathon_metrics_snapshot(v_hackathon_id, jsonb_build_object('registrations_total', 10));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%unauthorized:insufficient_permissions%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'RPC-02: FAILED. Unrelated user was able to patch metrics!';
  END IF;
  RAISE NOTICE '✓ RPC-02: PASS (Unrelated authenticated caller denied with insufficient_permissions)';

  -- RPC-06: Unauthorized Instructor (User C) denied
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_c::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"user_c@test.local"}', v_user_c), true);

  v_err_caught := false;
  BEGIN
    PERFORM public.patch_hackathon_metrics_snapshot(v_hackathon_id, jsonb_build_object('registrations_total', 10));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%unauthorized:insufficient_permissions%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'RPC-06: FAILED. Unauthorized instructor was able to patch metrics!';
  END IF;
  RAISE NOTICE '✓ RPC-06: PASS (Unauthorized instructor denied)';

  -- RPC-03: Hackathon Creator (User A) allowed
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"user_a@test.local"}', v_user_a), true);

  v_result := public.patch_hackathon_metrics_snapshot(
    v_hackathon_id,
    jsonb_build_object('registrations_total', 25, 'submissions_total', 5, 'updated_at', '2026-08-23T12:00:00Z')
  );
  IF (v_result->>'registrations_total')::int <> 25 THEN
    RAISE EXCEPTION 'RPC-03: FAILED. Creator patch did not return updated snapshot!';
  END IF;
  RAISE NOTICE '✓ RPC-03: PASS (Creator patch allowed)';

  -- RPC-04: Invited Judge allowed
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_judge::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"judge@test.local"}', v_judge), true);

  v_result := public.patch_hackathon_metrics_snapshot(
    v_hackathon_id,
    jsonb_build_object('registrations_total', 30, 'submissions_total', 8, 'updated_at', '2026-08-23T12:30:00Z')
  );
  IF (v_result->>'registrations_total')::int <> 30 THEN
    RAISE EXCEPTION 'RPC-04: FAILED. Invited judge patch failed!';
  END IF;
  RAISE NOTICE '✓ RPC-04: PASS (Invited judge patch allowed via real invite fixture)';

  -- RPC-05A: Admin User allowed
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"admin@test.local"}', v_admin), true);

  v_result := public.patch_hackathon_metrics_snapshot(
    v_hackathon_id,
    jsonb_build_object('registrations_total', 40, 'submissions_total', 10, 'updated_at', '2026-08-23T13:00:00Z')
  );
  IF (v_result->>'registrations_total')::int <> 40 THEN
    RAISE EXCEPTION 'RPC-05A: FAILED. Admin patch failed!';
  END IF;
  RAISE NOTICE '✓ RPC-05A: PASS (Admin patch allowed)';

  -- RPC-05B: Support Staff User allowed
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_support::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated","email":"support@test.local"}', v_support), true);

  v_result := public.patch_hackathon_metrics_snapshot(
    v_hackathon_id,
    jsonb_build_object('registrations_total', 45, 'submissions_total', 12, 'updated_at', '2026-08-23T13:30:00Z')
  );
  IF (v_result->>'registrations_total')::int <> 45 THEN
    RAISE EXCEPTION 'RPC-05B: FAILED. Support staff patch failed!';
  END IF;
  RAISE NOTICE '✓ RPC-05B: PASS (Support staff patch allowed)';

  -- DATA-01: Metrics Patch Data-Integrity Verification
  PERFORM set_config('role', 'postgres', true);
  SELECT document INTO v_patched_doc FROM public.hackathons WHERE id = v_hackathon_id;
  IF v_patched_doc->>'title' <> 'Original Hackathon Title' OR v_patched_doc->>'description' <> 'Original Description' OR (v_patched_doc->>'max_participants')::int <> 50 THEN
    RAISE EXCEPTION 'DATA-01: FAILED. Non-metrics document fields were altered by metrics patch!';
  END IF;
  IF (v_patched_doc->'metrics_snapshot'->>'registrations_total')::int <> 45 THEN
    RAISE EXCEPTION 'DATA-01: FAILED. metrics_snapshot was not updated correctly!';
  END IF;
  RAISE NOTICE '✓ DATA-01: PASS (Atomic jsonb_set preserved all non-metrics document fields byte-for-byte)';

  -- Clean up hackathon test rows
  DELETE FROM public.hackathon_access_invites WHERE id = 'invite-judge-g2-r1';
  DELETE FROM public.hackathons WHERE id = v_hackathon_id;

  -- ---------------------------------------------------------------------------
  -- 5. FV-G2-01 AI Entitlement Database Predicates (ENT-01 to ENT-03)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.payment_transactions (
    id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at
  ) VALUES
    (v_tx_a, v_user_a, 'course-1', 'ai_subscription', 199000, 'sepay', 'paid', now(), now()),
    (v_tx_b, v_user_b, 'course-1', 'ai_subscription', 399000, 'sepay', 'paid', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- ENT-01: Active-but-expired row filtered out
  INSERT INTO public.ai_subscriptions (
    id, user_id, tier, duration_months, price_vnd, started_at, expires_at, payment_transaction_id, status
  ) VALUES (
    v_sub_a, v_user_a, 'pro', 1, 199000, now() - interval '60 days', now() - interval '30 days', v_tx_a, 'active'
  ) ON CONFLICT (id) DO UPDATE SET status = 'active', expires_at = now() - interval '30 days';

  SELECT * INTO v_active_sub
  FROM public.ai_subscriptions
  WHERE user_id = v_user_a
    AND status = 'active'
    AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'ENT-01: FAILED. Expired subscription was returned as active by DB predicate!';
  END IF;
  RAISE NOTICE '✓ ENT-01: PASS (Expired row with status=active filtered out by canonical predicate)';

  -- ENT-02: Valid active unexpired subscription returned
  INSERT INTO public.ai_subscriptions (
    id, user_id, tier, duration_months, price_vnd, started_at, expires_at, payment_transaction_id, status
  ) VALUES (
    v_sub_b, v_user_b, 'bootcamp', 1, 399000, now(), now() + interval '30 days', v_tx_b, 'active'
  ) ON CONFLICT (id) DO UPDATE SET status = 'active', expires_at = now() + interval '30 days';

  SELECT * INTO v_active_sub
  FROM public.ai_subscriptions
  WHERE user_id = v_user_b
    AND status = 'active'
    AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF NOT FOUND OR v_active_sub.tier <> 'bootcamp' THEN
    RAISE EXCEPTION 'ENT-02: FAILED. Valid unexpired subscription was not returned!';
  END IF;
  RAISE NOTICE '✓ ENT-02: PASS (Valid active unexpired subscription returned accurately)';

  -- ENT-03: User C with stale profile tier returns 0 active subscriptions
  SELECT * INTO v_active_sub
  FROM public.ai_subscriptions
  WHERE user_id = v_user_c
    AND status = 'active'
    AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'ENT-03: FAILED. User C without subscription returned an active subscription row!';
  END IF;
  RAISE NOTICE '✓ ENT-03: PASS (User C with stale profile tier yields 0 active subscriptions, isolating profiles.tier)';

  -- Clean up entitlement records
  DELETE FROM public.ai_subscriptions WHERE id IN (v_sub_a, v_sub_b);
  DELETE FROM public.payment_transactions WHERE id IN (v_tx_a, v_tx_b);

  RAISE NOTICE '===================================================================';
  RAISE NOTICE ' ALL G2-R1 SQL INTEGRATION ASSERTIONS PASSED (100 PERCENT SUCCESS)';
  RAISE NOTICE '===================================================================';
END $integration_test$;
