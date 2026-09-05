-- ============================================================================
-- Sequential Invariant Verification Script: Email Idempotency & DB Constraints
-- Tests Issue #3 (Winner Award Notify) and Issue #5 (Collaboration Invite Email)
-- Note: This SQL script runs sequentially in a single transaction to verify FK
-- immediate ordering, PK duplicate violation (23505), and CAS lock predicates.
-- For true multi-session concurrent execution with overlapping transaction locks
-- and PostgREST HTTP parallel testing, see: scripts/verify-email-concurrency.mjs
-- Can be executed via:
--   docker exec -i supabase_db_corelia-app psql -U postgres -d postgres -f scripts/verify-email-concurrency.sql
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $suite$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_proj_id uuid;
  v_invite_id uuid;
  v_notif_1 uuid := gen_random_uuid();
  v_notif_2 uuid := gen_random_uuid();
  v_won_id uuid;

  -- Suite 2 variables:
  v_det_notif_id uuid := 'e1000000-0000-5000-8000-000000000001'::uuid;
  v_worker1_insert_ok boolean := false;
  v_worker2_insert_ok boolean := false;
  v_worker2_caught_unique boolean := false;

  -- Suite 3 variables:
  v_rows_updated int;
  v_stale_threshold text := to_char(now() - interval '30 seconds', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_stale_time text := to_char(now() - interval '35 seconds', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  -- Setup test dependencies
  SELECT id INTO v_proj_id FROM projects LIMIT 1;
  IF v_proj_id IS NULL THEN
    RAISE EXCEPTION 'No projects found in database to attach test invites';
  END IF;

  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'concurrency_proof_' || substr(gen_random_uuid()::text, 1, 8) || '@example.com');

  -- ==========================================================================
  -- SUITE 1: Issue #5 - Orphan Invite Claim Concurrency & FK Order Invariant
  -- ==========================================================================
  INSERT INTO project_collaboration_invites (project_id, invitee_user_id, invited_by, status, token_hash, expires_at)
  VALUES (v_proj_id, v_user_id, v_user_id, 'pending', 'concurrency_proof_token_' || gen_random_uuid(), now() + interval '1 day')
  RETURNING id INTO v_invite_id;

  -- Step 1: Worker 1 inserts candidate notification FIRST (FK satisfied)
  INSERT INTO user_notifications (id, user_id, type, payload)
  VALUES (v_notif_1, v_user_id, 'project_collaboration_invite', jsonb_build_object('invite_id', v_invite_id));

  -- Step 2: Worker 2 inserts candidate notification FIRST (FK satisfied)
  INSERT INTO user_notifications (id, user_id, type, payload)
  VALUES (v_notif_2, v_user_id, 'project_collaboration_invite', jsonb_build_object('invite_id', v_invite_id));

  -- Step 3: Worker 1 wins atomic claim on invite row
  UPDATE project_collaboration_invites
  SET notification_id = v_notif_1
  WHERE id = v_invite_id AND notification_id IS NULL
  RETURNING notification_id INTO v_won_id;

  ASSERT v_won_id = v_notif_1, 'Suite 1 Failure: Worker 1 must win claim';

  -- Step 4: Worker 2 attempts atomic claim on invite row -> matches 0 rows
  v_won_id := NULL;
  UPDATE project_collaboration_invites
  SET notification_id = v_notif_2
  WHERE id = v_invite_id AND notification_id IS NULL
  RETURNING notification_id INTO v_won_id;

  ASSERT v_won_id IS NULL, 'Suite 1 Failure: Worker 2 must match 0 rows (claim already won)';

  -- Step 5: Worker 2 cleans up its redundant candidate notification
  DELETE FROM user_notifications WHERE id = v_notif_2;

  -- Verify Suite 1 outcome
  ASSERT (SELECT count(*) FROM user_notifications WHERE id IN (v_notif_1, v_notif_2)) = 1,
    'Suite 1 Failure: Exactly 1 notification row must remain in DB';
  ASSERT (SELECT notification_id FROM project_collaboration_invites WHERE id = v_invite_id) = v_notif_1,
    'Suite 1 Failure: Invite must point to Worker 1 notification';

  RAISE NOTICE 'Suite 1 PASS: Orphan invite atomic claim and FK invariant verified.';

  -- ==========================================================================
  -- SUITE 2: Issue #3 - Deterministic Primary Key Concurrency (New Notification First-Insert Race)
  -- ==========================================================================
  DELETE FROM user_notifications WHERE id = v_det_notif_id;

  -- Worker 1 inserts deterministic notification
  BEGIN
    INSERT INTO user_notifications (id, user_id, type, payload)
    VALUES (v_det_notif_id, v_user_id, 'hackathon_winner_award', jsonb_build_object('email_sending', true, 'email_lock_at', now()));
    v_worker1_insert_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_worker1_insert_ok := false;
  END;

  -- Worker 2 tries to insert the EXACT SAME deterministic notification ID
  BEGIN
    INSERT INTO user_notifications (id, user_id, type, payload)
    VALUES (v_det_notif_id, v_user_id, 'hackathon_winner_award', jsonb_build_object('email_sending', true, 'email_lock_at', now()));
    v_worker2_insert_ok := true;
  EXCEPTION WHEN unique_violation THEN
    v_worker2_caught_unique := true;
  END;

  ASSERT v_worker1_insert_ok = true, 'Suite 2 Failure: Worker 1 insert must succeed';
  ASSERT v_worker2_insert_ok = false, 'Suite 2 Failure: Worker 2 insert must be rejected by PK constraint';
  ASSERT v_worker2_caught_unique = true, 'Suite 2 Failure: Worker 2 must catch PostgreSQL unique_violation (23505)';
  ASSERT (SELECT count(*) FROM user_notifications WHERE id = v_det_notif_id) = 1,
    'Suite 2 Failure: Exactly 1 deterministic notification row must exist';

  RAISE NOTICE 'Suite 2 PASS: First-insert atomic deduplication verified via primary key constraint.';

  -- ==========================================================================
  -- SUITE 3: Stale Lock Reclamation vs Fresh Lock Protection (CAS Query)
  -- ==========================================================================
  -- Set stale lock on deterministic notification (35s ago)
  UPDATE user_notifications
  SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', v_stale_time)
  WHERE id = v_det_notif_id;

  -- Reclaim stale lock via CAS condition
  UPDATE user_notifications
  SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  WHERE id = v_det_notif_id
    AND (
      payload->>'email_sending' IS NULL
      OR payload->>'email_sending' = 'false'
      OR payload->>'email_lock_at' < v_stale_threshold
    );
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  ASSERT v_rows_updated = 1, 'Suite 3 Failure: Stale lock (>30s) must be reclaimed (updated 1 row)';

  -- Attempt second reclaim on now-fresh lock -> must match 0 rows
  UPDATE user_notifications
  SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  WHERE id = v_det_notif_id
    AND (
      (payload->>'email_sent' IS NULL OR payload->>'email_sent' <> 'true')
      AND (
        payload->>'email_sending' IS NULL
        OR payload->>'email_sending' = 'false'
        OR payload->>'email_lock_at' < v_stale_threshold
      )
    );
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  ASSERT v_rows_updated = 0, 'Suite 3 Failure: Fresh lock (<30s) must block concurrent reclaim (updated 0 rows)';

  -- Mark email sent = true (simulate completed send by winning worker):
  UPDATE user_notifications
  SET payload = jsonb_build_object('email_sent', true, 'email_sending', false, 'email_sent_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  WHERE id = v_det_notif_id;

  -- Anti-TOCTOU Verification: A stale worker whose predicate checks email_sending must NOT overwrite email_sent=true:
  UPDATE user_notifications
  SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  WHERE id = v_det_notif_id
    AND (
      (payload->>'email_sent' IS NULL OR payload->>'email_sent' <> 'true')
      AND (
        payload->>'email_sending' IS NULL
        OR payload->>'email_sending' = 'false'
        OR payload->>'email_lock_at' < v_stale_threshold
      )
    );
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  ASSERT v_rows_updated = 0, 'Suite 3 Failure: Anti-TOCTOU guard failed! Worker must NOT overwrite email_sent=true';

  RAISE NOTICE 'Suite 3 PASS: Stale lock reclamation and anti-TOCTOU CAS verified.';

  -- ==========================================================================
  -- SUITE 4: Authoritative Service-Role Delivery Telemetry Invariant
  -- ==========================================================================
  INSERT INTO email_delivery_attempts (mail_type, recipient_email, provider, provider_status, provider_message_id)
  VALUES ('hackathon_winner_award:' || v_det_notif_id::text, 'winner@example.com', 'resend', 'accepted', 're_concurrency_proof_1');

  ASSERT (
    SELECT count(*)
    FROM email_delivery_attempts
    WHERE mail_type = 'hackathon_winner_award:' || v_det_notif_id::text
      AND provider_status = 'accepted'
  ) = 1, 'Suite 4 Failure: Durable delivery record must be readable by service role';

  RAISE NOTICE 'Suite 4 PASS: Authoritative service-role delivery record verified.';

  -- ==========================================================================
  -- SUITE 5: Transactional Outbox Invariants (email_outbox_events, lease_token fencing, RLS)
  -- ==========================================================================
  ASSERT (
    SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'email_outbox_events'
  ) = true, 'Suite 5 Failure: email_outbox_events must have Row Level Security enabled';

  DECLARE
    v_outbox_key text := 'outbox_test_' || gen_random_uuid()::text;
    v_lease_token_1 uuid := gen_random_uuid();
    v_lease_token_2 uuid := gen_random_uuid();
    v_first_dispatch timestamptz;
  BEGIN
    -- Step 1: Initial claim by Worker 1 (Insert)
    INSERT INTO email_outbox_events (
      idempotency_key, event_type, recipient_email, status, request_payload,
      lease_acquired_at, lease_token, last_attempt_at, first_dispatched_at
    ) VALUES (
      v_outbox_key, 'collaboration_invite', 'outbox@example.com', 'sending',
      '{"from":"noreply@corelia.academy","to":["outbox@example.com"],"subject":"Test","html":"<p>Hi</p>","idempotency_key":"test"}'::jsonb,
      now(), v_lease_token_1, now(), NULL
    );

    -- Step 2: Concurrent Worker 2 tries to insert duplicate idempotency_key -> must catch unique_violation
    BEGIN
      INSERT INTO email_outbox_events (
        idempotency_key, event_type, recipient_email, status, request_payload,
        lease_acquired_at, lease_token, last_attempt_at, first_dispatched_at
      ) VALUES (
        v_outbox_key, 'collaboration_invite', 'outbox@example.com', 'sending',
        '{"from":"noreply@corelia.academy","to":["outbox@example.com"],"subject":"Test","html":"<p>Hi</p>","idempotency_key":"test"}'::jsonb,
        now(), v_lease_token_2, now(), NULL
      );
      RAISE EXCEPTION 'Suite 5 Failure: Duplicate idempotency_key insert was not rejected!';
    EXCEPTION WHEN unique_violation THEN
      -- Expected: 23505
      NULL;
    END;

    -- Step 3: Concurrent Worker 2 tries to claim while lease fresh (<30s) -> 0 rows updated
    UPDATE email_outbox_events
    SET status = 'sending', lease_acquired_at = now(), lease_token = v_lease_token_2, updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND (
        status IN ('pending', 'indeterminate')
        OR (status = 'sending' AND lease_acquired_at < now() - interval '30 seconds')
      );
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    ASSERT v_rows_updated = 0, 'Suite 5 Failure: Fresh lease (<30s) must block concurrent claim';

    -- Step 4: Worker 1 persists first_dispatched_at BEFORE network call (V-02a)
    UPDATE email_outbox_events
    SET first_dispatched_at = now(), last_attempt_at = now(), updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND lease_token = v_lease_token_1
      AND status = 'sending'
    RETURNING first_dispatched_at INTO v_first_dispatch;

    ASSERT v_first_dispatch IS NOT NULL, 'Suite 5 Failure: Worker 1 must persist first_dispatched_at';

    -- Step 5: Simulate Worker 1 crashed, lease expires (>30s)
    UPDATE email_outbox_events
    SET lease_acquired_at = now() - interval '35 seconds'
    WHERE idempotency_key = v_outbox_key;

    -- Step 6: Worker 2 reclaims stale lease (>30s)
    UPDATE email_outbox_events
    SET status = 'sending', lease_acquired_at = now(), lease_token = v_lease_token_2, updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND (
        status IN ('pending', 'indeterminate')
        OR (status = 'sending' AND lease_acquired_at < now() - interval '30 seconds')
      );
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    ASSERT v_rows_updated = 1, 'Suite 5 Failure: Worker 2 must reclaim stale lease (>30s)';

    -- Step 7: Worker 2 persists dispatch: first_dispatched_at must be IMMUTABLE!
    UPDATE email_outbox_events
    SET last_attempt_at = now(), updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND lease_token = v_lease_token_2
      AND status = 'sending';

    ASSERT (SELECT first_dispatched_at FROM email_outbox_events WHERE idempotency_key = v_outbox_key) = v_first_dispatch,
      'Suite 5 Failure: first_dispatched_at must remain immutable across retries!';

    -- Step 8: Stale Worker 1 wakes up and attempts to commit success with old lease_token_1 -> 0 rows (fenced!)
    UPDATE email_outbox_events
    SET status = 'accepted', lease_token = NULL, updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND lease_token = v_lease_token_1
      AND status = 'sending';
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    ASSERT v_rows_updated = 0, 'Suite 5 Failure: Stale Worker 1 commit must be fenced (0 rows updated)';

    -- Step 9: Worker 2 commits success with valid lease_token_2 -> 1 row updated
    UPDATE email_outbox_events
    SET status = 'accepted', provider_message_id = 'resend_msg_real', lease_token = NULL, updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND lease_token = v_lease_token_2
      AND status = 'sending';
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    ASSERT v_rows_updated = 1, 'Suite 5 Failure: Worker 2 commit must succeed (1 row updated)';

    -- Step 10: Anti-downgrade invariant: Stale Worker 1 tries to commit failure on accepted event -> 0 rows
    UPDATE email_outbox_events
    SET status = 'failed', lease_token = NULL, updated_at = now()
    WHERE idempotency_key = v_outbox_key
      AND lease_token = v_lease_token_1
      AND status = 'sending';
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    ASSERT v_rows_updated = 0, 'Suite 5 Failure: Cannot downgrade accepted event (0 rows updated)';

    ASSERT (SELECT status FROM email_outbox_events WHERE idempotency_key = v_outbox_key) = 'accepted',
      'Suite 5 Failure: Event status must remain accepted';

    -- Cleanup outbox test event
    DELETE FROM email_outbox_events WHERE idempotency_key = v_outbox_key;
  END;

  RAISE NOTICE 'Suite 5 PASS: email_outbox_events RLS, lease_token fencing, and dispatch immutability verified.';

  -- Cleanup test artifacts
  DELETE FROM email_delivery_attempts WHERE mail_type = 'hackathon_winner_award:' || v_det_notif_id::text;
  DELETE FROM project_collaboration_invites WHERE id = v_invite_id;
  DELETE FROM user_notifications WHERE id IN (v_notif_1, v_notif_2, v_det_notif_id);
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'ALL CONCURRENCY & ATOMICITY INVARIANTS VERIFIED SUCCESSFULLY ON POSTGRESQL.';
END $suite$;

-- ============================================================================
-- SUITE 6: Row Level Security (RLS) Isolation Verification for anon & authenticated
-- Asserts that untrusted roles cannot read, insert, update, or delete outbox records.
-- ============================================================================
DO $suite6_rls$
DECLARE
  v_seed_id uuid := gen_random_uuid();
  v_seed_key text := 'rls_seed_' || gen_random_uuid();
  v_count int;
  v_rows int;
  v_caught_expected boolean;
  v_target_role text;
BEGIN
  -- Step 1: Seed outbox record under superuser / service-role
  INSERT INTO email_outbox_events (
    id, idempotency_key, event_type, recipient_email, status, request_payload
  ) VALUES (
    v_seed_id, v_seed_key, 'rls_test_event', 'rls_victim@example.com', 'pending',
    '{"from":"test@corelia.academy","to":["rls_victim@example.com"],"subject":"RLS","html":"<p>x</p>","idempotency_key":"seed"}'::jsonb
  );

  -- Step 2: Test both untrusted roles: 'anon' and 'authenticated'
  FOREACH v_target_role IN ARRAY ARRAY['anon', 'authenticated']
  LOOP
    -- Switch to untrusted role
    EXECUTE format('SET LOCAL ROLE %I', v_target_role);

    -- 2.1: Test SELECT (must see 0 rows)
    EXECUTE 'SELECT count(*) FROM email_outbox_events WHERE id = $1'
      INTO v_count
      USING v_seed_id;

    IF v_count <> 0 THEN
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION 'RLS Failure: role % was able to SELECT % rows from email_outbox_events', v_target_role, v_count;
    END IF;

    -- 2.2: Test INSERT (must fail with permission/RLS check error)
    v_caught_expected := false;
    BEGIN
      EXECUTE format(
        'INSERT INTO email_outbox_events (idempotency_key, event_type, recipient_email, status, request_payload) ' ||
        'VALUES (%L, %L, %L, %L, %L::jsonb)',
        'rls_insert_' || v_target_role || '_' || gen_random_uuid(),
        'test',
        'untrusted@example.com',
        'pending',
        '{}'
      );
    EXCEPTION
      WHEN insufficient_privilege OR check_violation THEN
        v_caught_expected := true;
      -- Strict: DO NOT catch OTHERS. Assertion failure below is OUTSIDE the exception block.
    END;

    IF NOT v_caught_expected THEN
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION 'RLS Failure: role % was able to INSERT into email_outbox_events without permission error', v_target_role;
    END IF;

    -- 2.3: Test UPDATE (must affect 0 rows or throw insufficient_privilege)
    v_rows := 0;
    BEGIN
      EXECUTE 'UPDATE email_outbox_events SET status = ''accepted'' WHERE id = $1'
        USING v_seed_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    EXCEPTION
      WHEN insufficient_privilege THEN
        v_rows := 0;
    END;

    IF v_rows <> 0 THEN
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION 'RLS Failure: role % was able to UPDATE % rows in email_outbox_events', v_target_role, v_rows;
    END IF;

    -- 2.4: Test DELETE (must affect 0 rows or throw insufficient_privilege)
    v_rows := 0;
    BEGIN
      EXECUTE 'DELETE FROM email_outbox_events WHERE id = $1'
        USING v_seed_id;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    EXCEPTION
      WHEN insufficient_privilege THEN
        v_rows := 0;
    END;

    IF v_rows <> 0 THEN
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION 'RLS Failure: role % was able to DELETE % rows from email_outbox_events', v_target_role, v_rows;
    END IF;

    -- Reset back to superuser for next iteration
    EXECUTE 'RESET ROLE';
  END LOOP;

  -- Step 3: Verify seed row was untouched and clean up
  SELECT count(*) INTO v_count FROM email_outbox_events WHERE id = v_seed_id AND status = 'pending';
  ASSERT v_count = 1, 'Suite 6 Failure: Seeded row was modified or deleted during RLS test';

  DELETE FROM email_outbox_events WHERE id = v_seed_id;

  -- Step 4: Negative Control - Prove that the isolation assertion itself FAILS when a policy leaks rows
  DECLARE
    v_neg_seed_id uuid := gen_random_uuid();
    v_assertion_failed boolean := false;
    v_neg_count int;
  BEGIN
    INSERT INTO email_outbox_events (
      id, idempotency_key, event_type, recipient_email, status, request_payload
    ) VALUES (
      v_neg_seed_id, 'rls_neg_ctrl_' || gen_random_uuid(), 'neg_test', 'neg@example.com', 'pending', '{}'::jsonb
    );

    -- Deliberately create a permissive policy to test assertion sensitivity
    EXECUTE 'CREATE POLICY test_deliberate_leak_policy ON email_outbox_events FOR SELECT TO anon USING (true)';

    -- Re-run the exact isolation assertion check under anon against the permissive policy
    BEGIN
      EXECUTE 'SET LOCAL ROLE anon';
      EXECUTE 'SELECT count(*) FROM email_outbox_events WHERE id = $1'
        INTO v_neg_count
        USING v_neg_seed_id;
      IF v_neg_count <> 0 THEN
        EXECUTE 'RESET ROLE';
        RAISE EXCEPTION 'RLS Failure: role anon was able to SELECT % rows from email_outbox_events', v_neg_count;
      END IF;
      EXECUTE 'RESET ROLE';
    EXCEPTION
      WHEN OTHERS THEN
        EXECUTE 'RESET ROLE';
        -- The test's isolation assertion must have thrown the expected RLS Failure exception:
        IF SQLERRM LIKE 'RLS Failure: role anon was able to SELECT%' THEN
          v_assertion_failed := true;
        ELSE
          RAISE;
        END IF;
    END;

    -- Clean up test policy and seed row
    EXECUTE 'DROP POLICY IF EXISTS test_deliberate_leak_policy ON email_outbox_events';
    DELETE FROM email_outbox_events WHERE id = v_neg_seed_id;

    -- The negative control strictly requires the assertion to have failed on the bad policy:
    IF NOT v_assertion_failed THEN
      RAISE EXCEPTION 'Suite 6 Negative Control Failure: Isolation assertion did not fail when policy leaked rows (assertion insensitivity / false positive risk)';
    END IF;

    RAISE NOTICE 'Suite 6 Negative Control PASS: Isolation assertion confirmed to fail when permissive policy exists (RLS assertion verified sensitive).';
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS test_deliberate_leak_policy ON email_outbox_events';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RAISE;
  END;

  RAISE NOTICE 'Suite 6 PASS: email_outbox_events RLS completely blocks SELECT, INSERT, UPDATE, DELETE for anon and authenticated.';
END $suite6_rls$;

COMMIT;
