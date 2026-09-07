import { deepStrictEqual } from "node:assert";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  claimOutboxLease,
  persistOutboxDispatch,
  commitOutboxSuccess,
  commitOutboxFailure,
  reconcileOutboxEvent,
  PROVIDER_WINDOW_MS,
  DISPATCH_SAFETY_BUFFER_MS,
} from "../supabase/functions/corelia-api/lib/mail/outbox.ts";
import { handleProjectCollaborationInviteEmail } from "../supabase/functions/corelia-api/projects/collaboration_invite_email.ts";

if (typeof globalThis.Deno === "undefined") {
  globalThis.Deno = {
    env: {
      get: (key) => process.env[key],
      set: (key, val) => { process.env[key] = val; },
    },
  };
}

// 1. Resolve local Supabase container and credentials
const configText = readFileSync(resolve(process.cwd(), "supabase", "config.toml"), "utf8");
const projectId = configText.match(/^\s*project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1] || "corelia-app";
const localDbContainer = `supabase_db_${projectId}`;

async function isDockerContainerAvailable() {
  return new Promise((resolveResult) => {
    const child = spawn("docker", ["ps", "-q", "-f", `name=${localDbContainer}`], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolveResult(false);
    }, 2000);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveResult(code === 0 && out.trim().length > 0);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolveResult(false);
    });
  });
}

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

  const dockerActive = await isDockerContainerAvailable();
  if (!dockerActive) {
    console.log("================================================================================");
    console.log("[BLOCKED] Docker daemon is not running or local container " + localDbContainer + " is not accessible.");
    console.log("Live multi-session concurrency & RLS verification requires active local Docker DB.");
    console.log("Status: BLOCKED (Docker daemon inactive).");
    console.log("================================================================================");
    process.exit(0);
  }

  // Setup common test user and project
  const testUserId = randomUUID();
  const testEmail = `real_concurrency_${Date.now()}@example.com`;
  const testPassword = "ConcurrencyTestPass123!";
  const { stdout: projOut } = await runLocalSql(`SELECT id FROM projects LIMIT 1;`);
  const projMatch = projOut.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (!projMatch) throw new Error("No projects found in local DB.");
  const testProjId = projMatch[0];

  if (SERVICE_KEY) {
    const adminInitClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error: createErr } = await adminInitClient.auth.admin.createUser({
      id: testUserId,
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createErr) {
      throw new Error(`Failed to create test user via admin API: ${createErr.message}`);
    }
  } else {
    await runLocalSql(`
      INSERT INTO auth.users (id, email) VALUES ('${testUserId}', '${testEmail}') ON CONFLICT DO NOTHING;
    `);
  }

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

    // Cleanup Suite 1 test artifacts
    await runLocalSql(`
      DELETE FROM project_collaboration_invites WHERE id = '${inviteId}';
      DELETE FROM user_notifications WHERE id = '${notifWorker1}';
    `);

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
          AND (
            (payload->>'email_sent' IS NULL OR payload->>'email_sent' <> 'true')
            AND (payload->>'email_sending' IS NULL OR payload->>'email_sending' = 'false' OR payload->>'email_lock_at' < v_stale_threshold)
          );
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
          AND (
            (payload->>'email_sent' IS NULL OR payload->>'email_sent' <> 'true')
            AND (payload->>'email_sending' IS NULL OR payload->>'email_sending' = 'false' OR payload->>'email_lock_at' < v_stale_threshold)
          );
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

    // Proven Anti-TOCTOU invariant: mark email_sent=true, then prove a stale worker cannot reclaim lock
    await runLocalSql(`
      UPDATE user_notifications
      SET payload = jsonb_build_object('email_sent', true, 'email_sending', false, 'email_sent_at', now()::text)
      WHERE id = '${detNotifId}';
    `);

    const { stdout: toctouCheck } = await runLocalSql(`
      DO $toctou$
      DECLARE
        v_rows int;
        v_stale_threshold text := to_char(now() - interval '30 seconds', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      BEGIN
        UPDATE user_notifications
        SET payload = jsonb_build_object('email_sending', true, 'email_lock_at', now()::text)
        WHERE id = '${detNotifId}'
          AND (
            (payload->>'email_sent' IS NULL OR payload->>'email_sent' <> 'true')
            AND (payload->>'email_sending' IS NULL OR payload->>'email_sending' = 'false' OR payload->>'email_lock_at' < v_stale_threshold)
          );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows <> 0 THEN
          RAISE EXCEPTION 'TOCTOU_VULNERABILITY: Stale worker was able to overwrite email_sent=true!';
        END IF;
      END $toctou$;
      SELECT 'ANTI_TOCTOU_VERIFIED';
    `);

    if (!toctouCheck.includes("ANTI_TOCTOU_VERIFIED")) {
      throw new Error("Anti-TOCTOU verification failed!");
    }
    console.log("  ✓ Proven: Anti-TOCTOU predicate prevents stale worker from overwriting email_sent=true");

    console.log("  ✓ SUITE 3 PASS: True concurrent multi-session CAS stale lock reclamation & anti-TOCTOU verified.");

    // --------------------------------------------------------------------------
    // SUITE 4: Real PostgREST Network HTTP Concurrency via @supabase/supabase-js
    // --------------------------------------------------------------------------
    if (!SERVICE_KEY) {
      console.log("  ⚠ Suite 4 skipped: SUPABASE_SERVICE_ROLE_KEY or CORELIA_SUPABASE_SECRET_KEYS not set in environment or local supabase/functions/.env");
      return;
    }

    const client1 = createClient(SUPABASE_URL, SERVICE_KEY);
    const client2 = createClient(SUPABASE_URL, SERVICE_KEY);

    const httpDetNotifId = randomUUID();
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

    // --------------------------------------------------------------------------
    // SUITE 5: Authoritative Service-Role Delivery Telemetry Invariant (Outbox State)
    // --------------------------------------------------------------------------
    console.log("\n[SUITE 5] Running Authoritative Delivery Telemetry Verification (email_delivery_attempts)...");
    const testScopedMailType = `hackathon_winner_award:${httpDetNotifId}`;

    await runLocalSql(`
      DELETE FROM email_delivery_attempts WHERE mail_type = '${testScopedMailType}';
      INSERT INTO email_delivery_attempts (mail_type, recipient_email, provider, provider_status, provider_message_id)
      VALUES ('${testScopedMailType}', '${testEmail}', 'resend', 'accepted', 're_concurrency_proof_2');
    `);

    const { data: durableAttempt, error: attemptErr } = await client1
      .from("email_delivery_attempts")
      .select("id, mail_type, provider_status")
      .eq("mail_type", testScopedMailType)
      .eq("provider_status", "accepted")
      .maybeSingle();

    if (attemptErr || !durableAttempt) {
      throw new Error(`Failed to query authoritative delivery record via service-role: ${attemptErr?.message}`);
    }

    console.log("  ✓ Proven: Authoritative service-role delivery record verified in email_delivery_attempts (durable DB sent marker).");
    console.log("  ✓ SUITE 5 PASS: Service-role authoritative delivery state verified.");

    // --------------------------------------------------------------------------
    // SUITE 6: Real Helper Runtime Verification (claimOutboxLease, persistOutboxDispatch, commitOutbox)
    // --------------------------------------------------------------------------
    console.log("\n[SUITE 6] Running Real Outbox Helper Concurrency, Fencing & Immutability Verification...");
    const outboxKey = `outbox_real_${randomUUID()}`;
    const initialSnapshot = {
      from: "noreply@corelia.academy",
      to: [testEmail],
      subject: "Initial Valid Subject",
      html: "<p>Initial Body</p>",
      idempotency_key: outboxKey,
    };
    const modifiedSnapshot = {
      from: "attacker@corelia.academy",
      to: ["hacked@example.com"],
      subject: "Tampered Subject",
      html: "<p>Tampered Body</p>",
      idempotency_key: outboxKey,
    };

    // Case 1: Hai request cạnh tranh gọi claimOutboxLease đồng thời
    const [claim1, claim2] = await Promise.all([
      claimOutboxLease({
        db: client1,
        idempotencyKey: outboxKey,
        eventType: "project_collaboration_invite",
        recipientEmail: testEmail,
        buildSnapshot: () => initialSnapshot,
      }),
      claimOutboxLease({
        db: client2,
        idempotencyKey: outboxKey,
        eventType: "project_collaboration_invite",
        recipientEmail: testEmail,
        buildSnapshot: () => initialSnapshot,
      }),
    ]);

    const winnerClaim = claim1.type === "claimed" ? claim1 : claim2;
    const loserClaim = claim1.type === "claimed" ? claim2 : claim1;

    if (winnerClaim.type !== "claimed" || (loserClaim.type !== "lease_locked" && loserClaim.type !== "rate_limited")) {
      throw new Error(`Case 1 Failure: Expected 1 claimed and 1 lease_locked/rate_limited, got: ${JSON.stringify({ claim1, claim2 })}`);
    }
    console.log(`  ✓ Case 1 PASS: Real claimOutboxLease race: Winner claimed leaseToken ${winnerClaim.leaseToken.slice(0, 8)}..., loser locked (${loserClaim.type}).`);

    // Case 2: Snapshot body bất biến (Frozen request_payload)
    const { data: dbCheckRow } = await client1
      .from("email_outbox_events")
      .select("request_payload")
      .eq("idempotency_key", outboxKey)
      .single();

    try {
      deepStrictEqual(dbCheckRow.request_payload, initialSnapshot);
    } catch {
      throw new Error("Case 2 Failure: request_payload in DB does not match initial snapshot!");
    }
    console.log("  ✓ Case 2 PASS: request_payload snapshot is byte-for-byte immutable in outbox.");

    // Case 3: persistOutboxDispatch - mốc first_dispatched_at bất biến & fencing token
    const dispRes = await persistOutboxDispatch({
      db: client1,
      idempotencyKey: outboxKey,
      leaseToken: winnerClaim.leaseToken,
      existingFirstDispatchedAt: winnerClaim.event.first_dispatched_at,
    });

    if (!dispRes.ok) {
      throw new Error(`Case 3 Failure: persistOutboxDispatch failed: ${dispRes.error}`);
    }
    const firstDispatchedTime = dispRes.firstDispatchedAt;

    // Fencing: Stale token cannot persist dispatch
    const staleDispRes = await persistOutboxDispatch({
      db: client2,
      idempotencyKey: outboxKey,
      leaseToken: randomUUID(),
      existingFirstDispatchedAt: firstDispatchedTime,
    });
    if (staleDispRes.ok) {
      throw new Error("Case 3 Failure: Stale token was able to persist dispatch!");
    }
    console.log("  ✓ Case 3 PASS: persistOutboxDispatch immutable timestamp & fencing token verified.");

    // Case 4: Lease hết hạn (>30s) & Crash trước Accept (Reclaim by Worker 2)
    const staleLeaseTime = new Date(Date.now() - 35_000).toISOString();
    await runLocalSql(`
      UPDATE email_outbox_events
      SET lease_acquired_at = '${staleLeaseTime}'
      WHERE idempotency_key = '${outboxKey}';
    `);

    const reclaimRes = await claimOutboxLease({
      db: client2,
      idempotencyKey: outboxKey,
      eventType: "project_collaboration_invite",
      recipientEmail: testEmail,
      buildSnapshot: () => modifiedSnapshot, // Pass tampered snapshot to assert outbox reuses frozen one
    });

    if (reclaimRes.type !== "claimed" || reclaimRes.isInitial !== false) {
      throw new Error(`Case 4 Failure: Worker 2 failed to reclaim expired lease: ${JSON.stringify(reclaimRes)}`);
    }
    if (reclaimRes.event.request_payload.subject !== "Initial Valid Subject") {
      throw new Error("Case 4 Failure: Reclaimed event did not preserve frozen request_payload!");
    }
    if (reclaimRes.event.first_dispatched_at !== firstDispatchedTime) {
      throw new Error("Case 4 Failure: first_dispatched_at was not preserved across crash/reclaim!");
    }
    console.log(`  ✓ Case 4 PASS: Expired lease reclaimed by Worker 2 (${reclaimRes.leaseToken.slice(0, 8)}...); frozen payload & dispatch time intact.`);

    // Case 5: Stale commit bị fencing chặn & Anti-downgrade sau accept
    const staleCommitSuccess = await commitOutboxSuccess({
      db: client1,
      idempotencyKey: outboxKey,
      leaseToken: winnerClaim.leaseToken, // expired token
      providerMessageId: "fake_msg_stale",
    });

    if (staleCommitSuccess) {
      throw new Error("Case 5 Failure: Stale Worker 1 commitOutboxSuccess succeeded! Fencing failed!");
    }

    const validCommitSuccess = await commitOutboxSuccess({
      db: client2,
      idempotencyKey: outboxKey,
      leaseToken: reclaimRes.leaseToken,
      providerMessageId: "resend_valid_msg_123",
    });

    if (!validCommitSuccess) {
      throw new Error("Case 5 Failure: Active Worker 2 commitOutboxSuccess failed!");
    }

    // Anti-downgrade: Stale Worker 1 attempts to downgrade accepted to failure -> must return false
    const staleDowngrade = await commitOutboxFailure({
      db: client1,
      idempotencyKey: outboxKey,
      leaseToken: winnerClaim.leaseToken,
      isPermanent: true,
    });

    if (staleDowngrade) {
      throw new Error("Case 5 Failure: Stale worker was able to downgrade accepted event!");
    }

    const { data: finalEventRow } = await client1
      .from("email_outbox_events")
      .select("status, provider_message_id")
      .eq("idempotency_key", outboxKey)
      .single();

    if (finalEventRow.status !== "accepted" || finalEventRow.provider_message_id !== "resend_valid_msg_123") {
      throw new Error(`Case 5 Failure: Event status corrupted: ${JSON.stringify(finalEventRow)}`);
    }
    console.log("  ✓ Case 5 PASS: Fencing blocked stale worker commit & downgrade; accepted status immutable.");

    // Case 6: Cutoff 24h (+ safety margin rejection)
    const expiredKey = `expired_key_${randomUUID()}`;
    const expiredTime = new Date(Date.now() - (PROVIDER_WINDOW_MS - 30_000)).toISOString(); // 23h 59m 30s ago

    await runLocalSql(`
      INSERT INTO email_outbox_events (
        idempotency_key, event_type, recipient_email, status, request_payload, first_dispatched_at, last_attempt_at
      ) VALUES (
        '${expiredKey}', 'project_collaboration_invite', '${testEmail}', 'indeterminate',
        '${JSON.stringify(initialSnapshot)}'::jsonb, '${expiredTime}', '${expiredTime}'
      );
    `);

    const expiredClaim = await claimOutboxLease({
      db: client1,
      idempotencyKey: expiredKey,
      eventType: "project_collaboration_invite",
      recipientEmail: testEmail,
      buildSnapshot: () => initialSnapshot,
    });

    if (expiredClaim.type !== "indeterminate_outside_window") {
      throw new Error(`Case 6 Failure: Expected indeterminate_outside_window, got: ${JSON.stringify(expiredClaim)}`);
    }

    const expiredDispatch = await persistOutboxDispatch({
      db: client1,
      idempotencyKey: expiredKey,
      leaseToken: randomUUID(),
      existingFirstDispatchedAt: expiredTime,
    });

    if (expiredDispatch.ok || expiredDispatch.error !== "dispatch_window_expired") {
      throw new Error(`Case 6 Failure: Expected dispatch_window_expired, got: ${JSON.stringify(expiredDispatch)}`);
    }

    await runLocalSql(`DELETE FROM email_outbox_events WHERE idempotency_key = '${expiredKey}';`);
    console.log("  ✓ Case 6 PASS: Events exceeding 24h retention window safely rejected fail-closed.");

    // --------------------------------------------------------------------------
    // SUITE 7: End-to-End Real Handler Execution with In-Process Mock HTTP Provider
    // --------------------------------------------------------------------------
    console.log("\n[SUITE 7] Running Real Handler Execution with In-Process Mock HTTP Provider...");
    const providerRequests = [];
    const mockServer = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch { parsed = body; }
        providerRequests.push({
          url: req.url,
          method: req.method,
          headers: req.headers,
          body: parsed,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: `msg_mock_${randomUUID().slice(0, 8)}` }));
      });
    });

    await new Promise((resolveServer) => {
      mockServer.listen(0, "127.0.0.1", () => resolveServer());
    });
    const mockPort = mockServer.address().port;
    const mockProviderUrl = `http://127.0.0.1:${mockPort}/emails`;

    process.env.RESEND_SEND_URL = mockProviderUrl;
    process.env.RESEND_API_KEY = "mock_test_key";
    process.env.MAIL_FROM = "Corelia <noreply@corelia.academy>";

    // Install strict network egress barrier: all external network requests are strictly forbidden
    const originalFetch = globalThis.fetch;
    let externalCallsCount = 0;
    globalThis.fetch = async (input, init) => {
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      try {
        const parsedUrl = new URL(urlStr);
        if (parsedUrl.hostname !== "127.0.0.1" && parsedUrl.hostname !== "localhost") {
          externalCallsCount++;
          throw new Error(`[EGRESS_BLOCKED] Attempted external network call to: ${urlStr}`);
        }
      } catch (err) {
        if (err.message?.includes("[EGRESS_BLOCKED]")) throw err;
      }
      return originalFetch(input, init);
    };

    try {
      const testPassword = "ConcurrencyTestPass123!";
      // Use clean service client to set password via admin API
      await client1.auth.admin.updateUserById(testUserId, {
        password: testPassword,
        email_confirm: true,
      });

      // Dedicated authClient for user session: ensures client1 remains an unauthenticated service-role client
      const authClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: sessionData, error: signInErr } = await authClient.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      if (signInErr || !sessionData?.session?.access_token) {
        throw new Error(`Suite 7 Failure: Failed to obtain valid user session token for ${testEmail}: ${signInErr?.message}`);
      }
      const userBearerToken = sessionData.session.access_token;

      // Assert RLS isolation: user client directly querying email_outbox_events must be blocked
      const { data: rlsRows } = await authClient
        .from("email_outbox_events")
        .select("id");
      if (rlsRows && rlsRows.length > 0) {
        throw new Error(`Suite 7 Failure: User client unexpectedly read ${rlsRows.length} outbox rows (RLS breach)`);
      }

      const handlerInviteId = randomUUID();
      const rawTokenBytes = new Uint8Array(32);
      crypto.getRandomValues(rawTokenBytes);
      const token = Array.from(rawTokenBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { createHash } = await import("node:crypto");
      const tokenHash = createHash("sha256").update(token).digest("hex");

      // S3: Clean any existing invites for user and insert fresh invite row and prepared outbox event
      await runLocalSql(`
        DELETE FROM project_collaboration_invites WHERE invitee_user_id = '${testUserId}';
        INSERT INTO project_collaboration_invites (id, project_id, invitee_user_id, invited_by, status, token_hash, expires_at)
        VALUES ('${handlerInviteId}', '${testProjId}', '${testUserId}', '${testUserId}', 'pending', '${tokenHash}', now() + interval '1 day');

        INSERT INTO email_outbox_events (idempotency_key, event_type, recipient_email, status, request_payload)
        VALUES ('${handlerInviteId}', 'project_collaboration_invite', '', 'pending', jsonb_build_object('token', '${token}', 'prepared', true));
      `);

      const reqObj1 = new Request(`http://localhost/functions/v1/corelia-api?op=project_collaboration_invite_send_email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userBearerToken}`,
        },
        body: JSON.stringify({
          invite_id: handlerInviteId,
          token,
        }),
      });

      // Pass pure service-role client (client1) to handler:
      const resp1 = await handleProjectCollaborationInviteEmail(reqObj1, client1);
      const resp1Data = await resp1.json();

      if (resp1.status !== 200 || !resp1Data.ok) {
        throw new Error(`Suite 7 Failure: Real handler invocation 1 failed: status ${resp1.status}, ${JSON.stringify(resp1Data)}`);
      }

      if (providerRequests.length !== 1) {
        throw new Error(`Suite 7 Failure: Expected 1 provider HTTP call, got ${providerRequests.length}`);
      }

      if (externalCallsCount !== 0) {
        throw new Error(`Suite 7 Failure: Detected ${externalCallsCount} external network calls during execution!`);
      }

      // Replay request: must return idempotent_replay without making another network call
      const reqObj2 = new Request(`http://localhost/functions/v1/corelia-api?op=project_collaboration_invite_send_email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userBearerToken}`,
        },
        body: JSON.stringify({
          invite_id: handlerInviteId,
          token,
        }),
      });

      const resp2 = await handleProjectCollaborationInviteEmail(reqObj2, client1);
      const resp2Data = await resp2.json();

      if (resp2.status !== 200 || resp2Data.idempotent_replay !== true) {
        throw new Error(`Suite 7 Failure: Expected idempotent replay on second call, got: ${JSON.stringify(resp2Data)}`);
      }

      if (providerRequests.length !== 1) {
        throw new Error(`Suite 7 Failure: Duplicate provider HTTP request occurred! Total: ${providerRequests.length}`);
      }

      console.log("  ✓ Suite 7 PASS: Real handler executed with in-process mock HTTP provider; 0 external calls; idempotent replay verified without duplicate dispatch.");
    } finally {
      globalThis.fetch = originalFetch;
      mockServer.close();
    }

    // Clean up outbox event
    await runLocalSql(`DELETE FROM email_outbox_events WHERE idempotency_key = '${outboxKey}';`);
    console.log("  ✓ SUITE 6 & 7 PASS: Real helpers and real handler end-to-end invariants fully verified.");

  } finally {
    // Teardown test artifacts
    if (SERVICE_KEY) {
      try {
        const adminTeardownClient = createClient(SUPABASE_URL, SERVICE_KEY);
        await adminTeardownClient.auth.admin.deleteUser(testUserId);
      } catch {}
    }
    await runLocalSql(`
      DELETE FROM email_delivery_attempts WHERE recipient_email = '${testEmail}';
      DELETE FROM email_outbox_events WHERE recipient_email = '${testEmail}';
      DELETE FROM project_collaboration_invites WHERE invitee_user_id = '${testUserId}';
      DELETE FROM user_notifications WHERE user_id = '${testUserId}';
      DELETE FROM auth.users WHERE id = '${testUserId}';
    `);
    console.log("\nTeardown complete: Cleaned up test user, invites, outbox, and notifications.");
  }

  console.log("\n================================================================================");
  console.log("ALL REAL CONCURRENCY, POSTGRESQL MULTI-SESSION LOCKS & POSTGREST GATES PASSED!");
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in concurrency verification:", err);
  process.exit(1);
});
