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
      payload->>'email_sending' IS NULL
      OR payload->>'email_sending' = 'false'
      OR payload->>'email_lock_at' < v_stale_threshold
    );
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  ASSERT v_rows_updated = 0, 'Suite 3 Failure: Fresh lock (<30s) must block concurrent reclaim (updated 0 rows)';

  RAISE NOTICE 'Suite 3 PASS: Stale lock reclamation and fresh lock CAS verified.';

  -- Cleanup test artifacts
  DELETE FROM project_collaboration_invites WHERE id = v_invite_id;
  DELETE FROM user_notifications WHERE id IN (v_notif_1, v_notif_2, v_det_notif_id);
  DELETE FROM auth.users WHERE id = v_user_id;

  RAISE NOTICE 'ALL CONCURRENCY & ATOMICITY INVARIANTS VERIFIED SUCCESSFULLY ON POSTGRESQL.';
END $suite$;

COMMIT;
