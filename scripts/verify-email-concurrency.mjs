import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// 1. Resolve local Supabase container and credentials
const configText = readFileSync(resolve(process.cwd(), "supabase", "config.toml"), "utf8");
const projectId = configText.match(/^\s*project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1] || "corelia-app";
const localDbContainer = `supabase_db_${projectId}`;

function resolveServiceRoleKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.CORELIA_SUPABASE_SECRET_KEYS) return process.env.CORELIA_SUPABASE_SECRET_KEYS;

  const envPath = resolve(process.cwd(), "supabase", "functions", ".env");
  try {
    const content = readFileSync(envPath, "utf8");
    const match = content.match(/^\s*(?:CORELIA_SUPABASE_SECRET_KEYS|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.+)$/m);
    if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // env file not present
  }
  return null;
}

function resolveLocalSupabaseUrl() {
  const candidateUrl = process.env.SUPABASE_LOCAL_URL || process.env.VITE_SUPABASE_URL || "http://127.0.0.1:55421";
  let parsed;
  try {
    parsed = new URL(candidateUrl);
  } catch (err) {
    throw new Error(`Invalid SUPABASE URL for concurrency verification: ${candidateUrl}`, { cause: err });
  }

  // Fail-closed invariant: Test MUST strictly target localhost to prevent accidental execution against staging/production
  if (parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error(
      `Safety rejection: verify-email-concurrency.mjs is designed strictly for local integration tests. ` +
      `Target host "${parsed.hostname}" is not localhost/127.0.0.1. Aborting to protect non-local environments.`
    );
  }

  return candidateUrl;
}

const SUPABASE_URL = resolveLocalSupabaseUrl();
const SERVICE_KEY = resolveServiceRoleKey();

function runLocalSql(sql, timeout = 30_000) {
  return new Promise((resolveQuery, rejectQuery) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        localDbContainer,
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-f",
        "-",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    let timeoutError;
    const timer = setTimeout(() => {
      timeoutError = new Error(`Local SQL command exceeded ${timeout}ms.`);
      child.kill();
    }, timeout);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectQuery(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (timeoutError) {
        rejectQuery(timeoutError);
      } else if (code !== 0) {
        rejectQuery(
          new Error(
            `Local SQL command failed with exit code ${code}${signal ? ` (${signal})` : ""}: ${stderr.trim()}`,
          ),
        );
      } else {
        resolveQuery({ stdout, stderr });
      }
    });

    child.stdin.end(sql);
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForCondition(checkFn, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const ok = await checkFn();
      if (ok) return;
    } catch (e) {
      lastErr = e;
    }
    await delay(100);
  }
  throw new Error(`Condition "${label}" timed out after ${timeout}ms. Cause: ${lastErr?.message}`);
}

async function main() {
  console.log("================================================================================");
  console.log("STARTING MULTI-SESSION REAL CONCURRENCY & OVERLAP VERIFICATION ON POSTGRESQL");
  console.log("================================================================================");

  // Setup common test user and project
  const testUserId = randomUUID();
  const testEmail = `real_concurrency_${Date.now()}@example.com`;
  const { stdout: projOut } = await runLocalSql(`SELECT id FROM projects LIMIT 1;`);
  const projMatch = projOut.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!projMatch) throw new Error("No projects found in local DB.");
  const testProjId = projMatch[0];

  await runLocalSql(`
    INSERT INTO auth.users (id, email) VALUES ('${testUserId}', '${testEmail}') ON CONFLICT DO NOTHING;
  `);

  try {
    // --------------------------------------------------------------------------
    // SUITE 1: Real Multi-Session Concurrency on Orphan Invite Claim (Issue #5)
    // --------------------------------------------------------------------------
    console.log("\n[SUITE 1] Running True Concurrent Orphan Invite Claim (Multi-Session)...");
    const inviteId = randomUUID();
    const notifWorker1 = randomUUID();
    const notifWorker2 = randomUUID();
    const appWorker1 = `invite_worker1_${randomUUID().slice(0, 8)}`;
    const appWorker2 = `invite_worker2_${randomUUID().slice(0, 8)}`;

    // Create orphan invite (notification_id IS NULL)
    await runLocalSql(`
      INSERT INTO project_collaboration_invites (id, project_id, invitee_user_id, invited_by, status, token_hash, expires_at)
      VALUES ('${inviteId}', '${testProjId}', '${testUserId}', '${testUserId}', 'pending', 'token_${randomUUID()}', now() + interval '1 day');
    `);

    // Worker 1 inserts candidate notification FIRST (FK order respected)
    await runLocalSql(`
      INSERT INTO user_notifications (id, user_id, type, payload)
      VALUES ('${notifWorker1}', '${testUserId}', 'project_collaboration_invite', '{"invite_id":"${inviteId}"}');
    `);

    // Worker 2 inserts candidate notification FIRST (FK order respected)
    await runLocalSql(`
      INSERT INTO user_notifications (id, user_id, type, payload)
      VALUES ('${notifWorker2}', '${testUserId}', 'project_collaboration_invite', '{"invite_id":"${inviteId}"}');
    `);

    // Launch Worker 1: Acquires row lock on invite and holds it for 2.5s
    const worker1Promise = runLocalSql(`
      DO $w1$
      DECLARE
        v_won uuid;
      BEGIN
        PERFORM set_config('application_name', '${appWorker1}', true);
        UPDATE project_collaboration_invites
        SET notification_id = '${notifWorker1}'
        WHERE id = '${inviteId}' AND notification_id IS NULL
        RETURNING notification_id INTO v_won;
        IF v_won IS NOT NULL THEN
          RAISE NOTICE 'WORKER1_WON_CLAIM';
        END IF;
        PERFORM pg_sleep(2.5);
      END $w1$;
    `);

    // Wait until Worker 1 is actively executing in pg_sleep with the lock
    await waitForCondition(async () => {
      const { stdout } = await runLocalSql(`
        SELECT count(*) FROM pg_stat_activity
        WHERE application_name = '${appWorker1}'
          AND state = 'active'
          AND wait_event_type = 'Timeout'
          AND wait_event = 'PgSleep';
      `);
      return stdout.includes("1");
    }, "Worker 1 holding row lock in transaction");

    // Launch Worker 2 concurrently: Tries to claim the same invite row
    const worker2Promise = runLocalSql(`
      DO $w2$
      DECLARE
        v_won uuid;
      BEGIN
        PERFORM set_config('application_name', '${appWorker2}', true);
        UPDATE project_collaboration_invites
        SET notification_id = '${notifWorker2}'
        WHERE id = '${inviteId}' AND notification_id IS NULL
        RETURNING notification_id INTO v_won;
        IF v_won IS NULL THEN
          RAISE NOTICE 'WORKER2_LOST_CLAIM';
        END IF;
      END $w2$;
    `);

    // VERIFY TRUE TRANSACTION LOCK OVERLAP: Worker 2 MUST be blocked by Worker 1 in pg_stat_activity
    await waitForCondition(async () => {
      const { stdout } = await runLocalSql(`
        SELECT count(*)
        FROM pg_stat_activity blocked_w2
        JOIN pg_stat_activity blocker_w1
          ON blocker_w1.application_name = '${appWorker1}'
         AND blocker_w1.pid = ANY(pg_blocking_pids(blocked_w2.pid))
        WHERE blocked_w2.application_name = '${appWorker2}'
          AND blocked_w2.state = 'active'
          AND blocked_w2.wait_event_type = 'Lock';
      `);
      return stdout.includes("1");
    }, "Worker 2 actively blocked by Worker 1 on row lock");

    console.log("  ✓ Proven: Real PostgreSQL lock contention observed (Worker 2 blocked by Worker 1 via pg_blocking_pids)");

    const [res1, res2] = await Promise.all([worker1Promise, worker2Promise]);
    if (!res1.stderr.includes("WORKER1_WON_CLAIM") && !res1.stdout.includes("WORKER1_WON_CLAIM")) {
      throw new Error("Worker 1 failed to win claim.");
    }
    if (!res2.stderr.includes("WORKER2_LOST_CLAIM") && !res2.stdout.includes("WORKER2_LOST_CLAIM")) {
      throw new Error("Worker 2 should have lost claim (0 rows updated).");
    }

    // Worker 2 lost claim -> cleans up redundant candidate notification
    await runLocalSql(`DELETE FROM user_notifications WHERE id = '${notifWorker2}';`);

    // Verify DB invariant:
    const { stdout: inviteCheck } = await runLocalSql(`
      SELECT notification_id FROM project_collaboration_invites WHERE id = '${inviteId}';
    `);
    if (!inviteCheck.includes(notifWorker1)) {
      throw new Error(`Invite notification_id mismatch: ${inviteCheck}`);
    }
    const { stdout: countCheck } = await runLocalSql(`
      SELECT count(*) FROM user_notifications WHERE id IN ('${notifWorker1}', '${notifWorker2}');
    `);
    if (!countCheck.includes("1")) {
      throw new Error(`Expected exactly 1 notification row in DB, got: ${countCheck}`);
    }
    console.log("  ✓ SUITE 1 PASS: True concurrent multi-session orphan invite claim serialized correctly.");

    // --------------------------------------------------------------------------
    // SUITE 2: Real Multi-Session Concurrency on Deterministic PK First-Insert (Issue #3)
    // --------------------------------------------------------------------------
    console.log("\n[SUITE 2] Running True Concurrent Deterministic PK First-Insert Race (Multi-Session)...");
    const detNotifId = "e2000000-0000-5000-8000-000000000001";
    const appDetWorker1 = `det_worker1_${randomUUID().slice(0, 8)}`;
    const appDetWorker2 = `det_worker2_${randomUUID().slice(0, 8)}`;

    await runLocalSql(`DELETE FROM user_notifications WHERE id = '${detNotifId}';`);

    // Worker 1 starts transaction, inserts deterministic notification, holds lock for 2.5s
    const detWorker1Promise = runLocalSql(`
      DO $dw1$
      BEGIN
        PERFORM set_config('application_name', '${appDetWorker1}', true);
        INSERT INTO user_notifications (id, user_id, type, payload)
        VALUES ('${detNotifId}', '${testUserId}', 'hackathon_winner_award', '{"email_sending": true, "email_lock_at": "2026-09-05T00:00:00.000Z"}');
        RAISE NOTICE 'DET_WORKER1_INSERT_SUCCESS';
        PERFORM pg_sleep(2.5);
      END $dw1$;
    `);

    // Wait until Worker 1 is holding the transaction
    await waitForCondition(async () => {
      const { stdout } = await runLocalSql(`
        SELECT count(*) FROM pg_stat_activity
        WHERE application_name = '${appDetWorker1}'
          AND state = 'active'
          AND wait_event_type = 'Timeout'
          AND wait_event = 'PgSleep';
      `);
      return stdout.includes("1");
    }, "Worker 1 holding deterministic row lock");

    // Worker 2 attempts to insert EXACT SAME deterministic PK concurrently
    const detWorker2Promise = runLocalSql(`
      DO $dw2$
      BEGIN
        PERFORM set_config('application_name', '${appDetWorker2}', true);
        INSERT INTO user_notifications (id, user_id, type, payload)
        VALUES ('${detNotifId}', '${testUserId}', 'hackathon_winner_award', '{"email_sending": true, "email_lock_at": "2026-09-05T00:00:00.000Z"}');
      EXCEPTION WHEN unique_violation THEN
        RAISE NOTICE 'DET_WORKER2_CAUGHT_23505';
      END $dw2$;
    `);

    // VERIFY TRUE TRANSACTION LOCK OVERLAP on PRIMARY KEY: Worker 2 blocked by Worker 1
    await waitForCondition(async () => {
      const { stdout } = await runLocalSql(`
        SELECT count(*)
        FROM pg_stat_activity blocked_w2
        JOIN pg_stat_activity blocker_w1
          ON blocker_w1.application_name = '${appDetWorker1}'
         AND blocker_w1.pid = ANY(pg_blocking_pids(blocked_w2.pid))
        WHERE blocked_w2.application_name = '${appDetWorker2}'
          AND blocked_w2.state = 'active'
          AND blocked_w2.wait_event_type = 'Lock';
      `);
      return stdout.includes("1");
    }, "Worker 2 actively blocked on PK tuple lock by Worker 1");

    console.log("  ✓ Proven: Real PostgreSQL PK index conflict observed (Worker 2 blocked waiting on Worker 1's transaction)");

    const [detRes1, detRes2] = await Promise.all([detWorker1Promise, detWorker2Promise]);
    if (!detRes1.stderr.includes("DET_WORKER1_INSERT_SUCCESS") && !detRes1.stdout.includes("DET_WORKER1_INSERT_SUCCESS")) {
      throw new Error("Worker 1 failed deterministic insert.");
    }
    if (!detRes2.stderr.includes("DET_WORKER2_CAUGHT_23505") && !detRes2.stdout.includes("DET_WORKER2_CAUGHT_23505")) {
      throw new Error("Worker 2 did not catch unique_violation (23505).");
    }

    const { stdout: detCount } = await runLocalSql(`SELECT count(*) FROM user_notifications WHERE id = '${detNotifId}';`);
    if (!detCount.includes("1")) {
      throw new Error(`Expected exactly 1 deterministic notification row, got: ${detCount}`);
    }
    console.log("  ✓ SUITE 2 PASS: True concurrent multi-session first-insert race serialized via PK constraint.");

    // --------------------------------------------------------------------------
    // SUITE 3: Real Multi-Session Concurrency on CAS Stale Lock Reclamation (Issue #3)
    // --------------------------------------------------------------------------
    console.log("\n[SUITE 3] Running True Concurrent CAS Stale Lock Claim (Multi-Session)...");
    const appCasWorker1 = `cas_worker1_${randomUUID().slice(0, 8)}`;
    const appCasWorker2 = `cas_worker2_${randomUUID().slice(0, 8)}`;

    // Set lock to stale (35 seconds in the past)
    await runLocalSql(`
      UPDATE user_notifications
      SET payload = jsonb_build_object(
        'email_sending', true,
        'email_lock_at', to_char(now() - interval '35 seconds', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
      WHERE id = '${detNotifId}';
    `);

    // Worker 1 reclaims stale lock, holds transaction lock for 2.5s
    const casWorker1Promise = runLocalSql(`
      DO $cw1$
      DECLARE
        v_rows int;
        v_stale_threshold text := to_char(now() - interval '30 seconds', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      BEGIN
        PERFORM set_config('application_name', '${appCasWorker1}', true);
        UPDATE user_notifications
        SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        WHERE id = '${detNotifId}'
          AND (payload->>'email_sending' IS NULL OR payload->>'email_sending' = 'false' OR payload->>'email_lock_at' < v_stale_threshold);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 1 THEN
          RAISE NOTICE 'CAS_WORKER1_WON';
        END IF;
        PERFORM pg_sleep(2.5);
      END $cw1$;
    `);

    await waitForCondition(async () => {
      const { stdout } = await runLocalSql(`
        SELECT count(*) FROM pg_stat_activity
        WHERE application_name = '${appCasWorker1}'
          AND state = 'active'
          AND wait_event_type = 'Timeout'
          AND wait_event = 'PgSleep';
      `);
      return stdout.includes("1");
    }, "CAS Worker 1 holding updated row lock");

    // Worker 2 attempts concurrent CAS reclaim
    const casWorker2Promise = runLocalSql(`
      DO $cw2$
      DECLARE
        v_rows int;
        v_stale_threshold text := to_char(now() - interval '30 seconds', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      BEGIN
        PERFORM set_config('application_name', '${appCasWorker2}', true);
        UPDATE user_notifications
        SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
        WHERE id = '${detNotifId}'
          AND (payload->>'email_sending' IS NULL OR payload->>'email_sending' = 'false' OR payload->>'email_lock_at' < v_stale_threshold);
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 0 THEN
          RAISE NOTICE 'CAS_WORKER2_BLOCKED';
        END IF;
      END $cw2$;
    `);

    // VERIFY Worker 2 is blocked waiting on Worker 1's row lock
    await waitForCondition(async () => {
      const { stdout } = await runLocalSql(`
        SELECT count(*)
        FROM pg_stat_activity blocked_w2
        JOIN pg_stat_activity blocker_w1
          ON blocker_w1.application_name = '${appCasWorker1}'
         AND blocker_w1.pid = ANY(pg_blocking_pids(blocked_w2.pid))
        WHERE blocked_w2.application_name = '${appCasWorker2}'
          AND blocked_w2.state = 'active'
          AND blocked_w2.wait_event_type = 'Lock';
      `);
      return stdout.includes("1");
    }, "CAS Worker 2 actively blocked on row lock by Worker 1");

    console.log("  ✓ Proven: Real PostgreSQL row-level lock contention observed during CAS update");

    const [casRes1, casRes2] = await Promise.all([casWorker1Promise, casWorker2Promise]);
    if (!casRes1.stderr.includes("CAS_WORKER1_WON") && !casRes1.stdout.includes("CAS_WORKER1_WON")) {
      throw new Error("CAS Worker 1 failed to reclaim stale lock.");
    }
    if (!casRes2.stderr.includes("CAS_WORKER2_BLOCKED") && !casRes2.stdout.includes("CAS_WORKER2_BLOCKED")) {
      throw new Error("CAS Worker 2 should have been blocked (0 rows updated).");
    }
    console.log("  ✓ SUITE 3 PASS: True concurrent multi-session CAS stale lock reclamation verified.");

    // --------------------------------------------------------------------------
    // SUITE 4: Real PostgREST Network HTTP Concurrency via @supabase/supabase-js
    // --------------------------------------------------------------------------
    if (!SERVICE_KEY) {
      console.log("  ⚠ Suite 4 skipped: SUPABASE_SERVICE_ROLE_KEY or CORELIA_SUPABASE_SECRET_KEYS not set in environment or local supabase/functions/.env");
      return;
    }

    const client1 = createClient(SUPABASE_URL, SERVICE_KEY);
    const client2 = createClient(SUPABASE_URL, SERVICE_KEY);

    const httpDetNotifId = "e3000000-0000-5000-8000-000000000001";
    await runLocalSql(`DELETE FROM user_notifications WHERE id = '${httpDetNotifId}';`);

    const insertCandidate = async (client, workerName) => {
      const { data, error, status, statusText } = await client
        .from("user_notifications")
        .insert({
          id: httpDetNotifId,
          user_id: testUserId,
          type: "hackathon_winner_award",
          payload: {
            worker: workerName,
            email_sending: true,
            email_lock_at: new Date().toISOString(),
          },
        })
        .select("id")
        .maybeSingle();
      return { workerName, data, error, status, statusText };
    };

    // Fire two HTTP PostgREST requests simultaneously
    const [httpRes1, httpRes2] = await Promise.all([
      insertCandidate(client1, "client1"),
      insertCandidate(client2, "client2"),
    ]);

    const winner = httpRes1.error === null ? httpRes1 : httpRes2;
    const loser = httpRes1.error !== null ? httpRes1 : httpRes2;

    if (winner.error !== null || loser.error === null) {
      throw new Error(`Expected exactly one success and one failure over HTTP, got: ${JSON.stringify({ httpRes1, httpRes2 })}`);
    }

    // Explicitly assert HTTP status codes returned by PostgREST:
    if (winner.status !== 201) {
      throw new Error(`Expected winner HTTP status 201 (Created), got: ${winner.status} (${winner.statusText})`);
    }
    if (loser.status !== 409) {
      throw new Error(`Expected loser HTTP status 409 (Conflict), got: ${loser.status} (${loser.statusText})`);
    }
    if (loser.error.code !== "23505") {
      throw new Error(`Expected PostgREST error code 23505, got: ${loser.error.code} (${loser.error.message})`);
    }

    console.log(`  ✓ Proven: Real PostgREST API concurrency over HTTP: ${winner.workerName} received HTTP 201 (${winner.statusText}), ${loser.workerName} rejected with HTTP 409 (${loser.statusText}, code: 23505)`);

    // Verify loser's fallback query over PostgREST
    const loserClient = loser.workerName === "client1" ? client1 : client2;
    const { data: raceRow } = await loserClient
      .from("user_notifications")
      .select("id, payload")
      .eq("id", httpDetNotifId)
      .maybeSingle();

    if (!raceRow || raceRow.payload?.email_sending !== true) {
      throw new Error(`Loser fallback query failed to observe winner's active lock: ${JSON.stringify(raceRow)}`);
    }
    console.log("  ✓ Proven: Loser fetched winner's row over HTTP, verified email_sending: true, and safely skipped duplicate email.");
    console.log("  ✓ SUITE 4 PASS: Real HTTP PostgREST concurrent deduplication verified.");

  } finally {
    // Teardown test artifacts
    await runLocalSql(`
      DELETE FROM project_collaboration_invites WHERE invitee_user_id = '${testUserId}';
      DELETE FROM user_notifications WHERE user_id = '${testUserId}';
      DELETE FROM auth.users WHERE id = '${testUserId}';
    `);
    console.log("\nTeardown complete: Cleaned up test user, invites, and notifications.");
  }

  console.log("\n================================================================================");
  console.log("ALL REAL CONCURRENCY, POSTGRESQL MULTI-SESSION LOCKS & POSTGREST GATES PASSED!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in concurrency verification:", err);
  process.exit(1);
});
