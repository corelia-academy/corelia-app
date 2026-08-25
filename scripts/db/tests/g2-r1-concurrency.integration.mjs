import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configText = readFileSync(resolve(process.cwd(), "supabase", "config.toml"), "utf8");
const projectId = configText.match(/^\s*project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
if (!projectId) {
  throw new Error("Unable to resolve a safe Supabase project_id from supabase/config.toml.");
}
const localDbContainer = `supabase_db_${projectId}`;

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
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
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

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function waitForDatabaseCondition(sql, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let lastError;

  while (Date.now() < deadline) {
    try {
      await runLocalSql(sql, 5_000);
      return;
    } catch (error) {
      lastError = error;
      await delay(100);
    }
  }

  throw new Error(`${label} was not observed before timeout.`, { cause: lastError });
}

async function assertCompatibilityInvariant(sessionId, foreignSessionId, expectedCount, label) {
  await runLocalSql(
    `
    DO $verify$
    DECLARE
      v_stored_count int;
      v_canonical_count int;
      v_foreign_stored_count int;
      v_foreign_canonical_count int;
      v_affected int;
    BEGIN
      SELECT message_count INTO STRICT v_stored_count
      FROM public.ai_chat_sessions
      WHERE id = '${sessionId}';

      SELECT count(*)::int INTO v_canonical_count
      FROM public.ai_conversations
      WHERE session_id = '${sessionId}'::uuid
        AND status = 'completed';

      IF v_stored_count IS DISTINCT FROM v_canonical_count
         OR v_stored_count IS DISTINCT FROM ${expectedCount} THEN
        RAISE EXCEPTION '${label}: stored count %, canonical count %, expected %',
          v_stored_count, v_canonical_count, ${expectedCount};
      END IF;

      -- User A must not be able to mutate User B's aggregate while the
      -- compatibility guard is installed.
      PERFORM set_config('role', 'authenticated', true);
      PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
      PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
      PERFORM set_config(
        'request.jwt.claims',
        '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
        true
      );
      UPDATE public.ai_chat_sessions
      SET message_count = 999
      WHERE id = '${foreignSessionId}'::uuid;
      GET DIAGNOSTICS v_affected = ROW_COUNT;
      IF v_affected <> 0 THEN
        RAISE EXCEPTION '${label}: User A updated foreign Session B';
      END IF;

      PERFORM set_config('role', 'postgres', true);
      SELECT message_count INTO STRICT v_foreign_stored_count
      FROM public.ai_chat_sessions
      WHERE id = '${foreignSessionId}';
      SELECT count(*)::int INTO v_foreign_canonical_count
      FROM public.ai_conversations
      WHERE session_id = '${foreignSessionId}'::uuid
        AND status = 'completed';

      IF v_foreign_stored_count IS DISTINCT FROM v_foreign_canonical_count
         OR v_foreign_stored_count IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION '${label}: foreign Session B corrupted (stored %, canonical %)',
          v_foreign_stored_count, v_foreign_canonical_count;
      END IF;
    END
    $verify$;
    `,
  );
}

async function runOldEdgeCompatibilityConcurrencyTest() {
  const runToken = randomUUID().replaceAll("-", "");
  const sessionCanonicalFirst = randomUUID();
  const sessionOldEdgeFirst = randomUUID();
  const foreignSession = randomUUID();
  const conversationCanonicalFirst = randomUUID();
  const conversationOldEdgeFirst = randomUUID();

  const canonicalWriterA = `compat_canonical_first_${runToken}`;
  const oldEdgeWriterA = `compat_old_edge_second_${runToken}`;
  const oldEdgeWriterB = `compat_old_edge_first_${runToken}`;
  const canonicalWriterB = `compat_canonical_second_${runToken}`;

  console.log("Starting COMPAT-OLD-EDGE-NEW-DB-01 two-ordering concurrency test...");

  const sessions = [sessionCanonicalFirst, sessionOldEdgeFirst, foreignSession];
  const conversations = [conversationCanonicalFirst, conversationOldEdgeFirst];
  const activePromises = [];
  let testError;

  try {
    await runLocalSql(
      `
      INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
      VALUES
        ('11111111-1111-4111-8111-111111111111', 'compat-user-a@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"Compat User A"}'),
        ('22222222-2222-4222-8222-222222222222', 'compat-user-b@test.local', 'authenticated', 'authenticated', '{"provider":"email"}', '{"name":"Compat User B"}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.profiles (id, full_name, role, tier)
      VALUES
        ('11111111-1111-4111-8111-111111111111', 'Compat User A', 'student', 'free'),
        ('22222222-2222-4222-8222-222222222222', 'Compat User B', 'student', 'free')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.ai_chat_sessions (id, user_id, context_type, title, message_count)
      VALUES
        ('${sessionCanonicalFirst}', '11111111-1111-4111-8111-111111111111', 'dashboard', 'Canonical writer first', 0),
        ('${sessionOldEdgeFirst}', '11111111-1111-4111-8111-111111111111', 'dashboard', 'Old Edge writer first', 0),
        ('${foreignSession}', '22222222-2222-4222-8222-222222222222', 'dashboard', 'Foreign Session B', 0);

      INSERT INTO public.ai_conversations (id, user_id, session_id, role, content, status)
      VALUES
        ('${conversationCanonicalFirst}', '11111111-1111-4111-8111-111111111111', '${sessionCanonicalFirst}', 'assistant', 'pending canonical-first', 'pending'),
        ('${conversationOldEdgeFirst}', '11111111-1111-4111-8111-111111111111', '${sessionOldEdgeFirst}', 'assistant', 'pending old-edge-first', 'pending');
      `,
    );

    // Ordering A: canonical transition obtains the session row lock first.
    // The stale OLD EDGE update must block, then normalize against committed
    // conversation truth after the canonical transaction commits.
    const canonicalFirstPromise = runLocalSql(
      `
      DO $canonical_first$
      BEGIN
        PERFORM set_config('application_name', '${canonicalWriterA}', true);
        UPDATE public.ai_conversations
        SET status = 'completed', content = 'completed canonical-first'
        WHERE id = '${conversationCanonicalFirst}';
        PERFORM pg_sleep(5);
      END
      $canonical_first$;
      `,
    );
    canonicalFirstPromise.catch(() => {});
    activePromises.push(canonicalFirstPromise);

    await waitForDatabaseCondition(
      `
      DO $probe$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE application_name = '${canonicalWriterA}'
            AND state = 'active'
            AND wait_event_type = 'Timeout'
            AND wait_event = 'PgSleep'
            AND xact_start IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'COMPAT_CANONICAL_FIRST_LOCK_NOT_READY';
        END IF;
      END
      $probe$;
      `,
      "Canonical transition holding the session row lock",
    );

    const staleSecondPromise = runLocalSql(
      `
      DO $old_edge_second$
      BEGIN
        PERFORM set_config('application_name', '${oldEdgeWriterA}', true);
        UPDATE public.ai_chat_sessions
        SET message_count = 2
        WHERE id = '${sessionCanonicalFirst}';
      END
      $old_edge_second$;
      `,
    );
    staleSecondPromise.catch(() => {});
    activePromises.push(staleSecondPromise);

    await waitForDatabaseCondition(
      `
      DO $probe$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_stat_activity stale_writer
          JOIN pg_stat_activity canonical_writer
            ON canonical_writer.application_name = '${canonicalWriterA}'
           AND canonical_writer.pid = ANY(pg_blocking_pids(stale_writer.pid))
          WHERE stale_writer.application_name = '${oldEdgeWriterA}'
            AND stale_writer.state = 'active'
            AND stale_writer.wait_event_type = 'Lock'
        ) THEN
          RAISE EXCEPTION 'COMPAT_CANONICAL_FIRST_OVERLAP_NOT_OBSERVED';
        END IF;
      END
      $probe$;
      `,
      "Stale OLD EDGE writer blocked by canonical transition",
    );

    console.log("✓ COMPAT-ORDER-A-BARRIER: PASS (canonical transition blocked stale OLD EDGE write)");
    await Promise.all([canonicalFirstPromise, staleSecondPromise]);
    await assertCompatibilityInvariant(sessionCanonicalFirst, foreignSession, 1, "COMPAT-ORDER-A");

    // Ordering B: OLD EDGE direct update obtains the session row lock first.
    // The canonical transition must block, then increment the post-guard row.
    const staleFirstPromise = runLocalSql(
      `
      DO $old_edge_first$
      BEGIN
        PERFORM set_config('application_name', '${oldEdgeWriterB}', true);
        UPDATE public.ai_chat_sessions
        SET message_count = 2
        WHERE id = '${sessionOldEdgeFirst}';
        PERFORM pg_sleep(5);
      END
      $old_edge_first$;
      `,
    );
    staleFirstPromise.catch(() => {});
    activePromises.push(staleFirstPromise);

    await waitForDatabaseCondition(
      `
      DO $probe$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE application_name = '${oldEdgeWriterB}'
            AND state = 'active'
            AND wait_event_type = 'Timeout'
            AND wait_event = 'PgSleep'
            AND xact_start IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'COMPAT_OLD_EDGE_FIRST_LOCK_NOT_READY';
        END IF;
      END
      $probe$;
      `,
      "OLD EDGE direct update holding the session row lock",
    );

    const canonicalSecondPromise = runLocalSql(
      `
      DO $canonical_second$
      BEGIN
        PERFORM set_config('application_name', '${canonicalWriterB}', true);
        UPDATE public.ai_conversations
        SET status = 'completed', content = 'completed after OLD EDGE'
        WHERE id = '${conversationOldEdgeFirst}';
      END
      $canonical_second$;
      `,
    );
    canonicalSecondPromise.catch(() => {});
    activePromises.push(canonicalSecondPromise);

    await waitForDatabaseCondition(
      `
      DO $probe$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_stat_activity canonical_writer
          JOIN pg_stat_activity stale_writer
            ON stale_writer.application_name = '${oldEdgeWriterB}'
           AND stale_writer.pid = ANY(pg_blocking_pids(canonical_writer.pid))
          WHERE canonical_writer.application_name = '${canonicalWriterB}'
            AND canonical_writer.state = 'active'
            AND canonical_writer.wait_event_type = 'Lock'
        ) THEN
          RAISE EXCEPTION 'COMPAT_OLD_EDGE_FIRST_OVERLAP_NOT_OBSERVED';
        END IF;
      END
      $probe$;
      `,
      "Canonical transition blocked by OLD EDGE direct update",
    );

    console.log("✓ COMPAT-ORDER-B-BARRIER: PASS (OLD EDGE write blocked canonical transition)");
    await Promise.all([staleFirstPromise, canonicalSecondPromise]);
    await assertCompatibilityInvariant(sessionOldEdgeFirst, foreignSession, 1, "COMPAT-ORDER-B");

    console.log("✓ COMPAT-OLD-EDGE-NEW-DB-01-CONCURRENCY: PASS (both lock orderings converged without cross-owner corruption)");
  } catch (error) {
    testError = error;
  }

  const sessionResults = await Promise.allSettled(activePromises);
  const sessionErrors = sessionResults
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  let cleanupError;
  try {
    await runLocalSql(
      `
      DELETE FROM public.ai_conversations
      WHERE id IN ('${conversations.join("','")}');
      DELETE FROM public.ai_chat_sessions
      WHERE id IN ('${sessions.join("','")}');
      `,
    );
  } catch (error) {
    cleanupError = error;
  }

  const errors = [testError, ...sessionErrors, cleanupError].filter(Boolean);
  if (errors.length > 1) {
    throw new AggregateError(errors, "OLD EDGE compatibility concurrency test, sessions, or cleanup failed.");
  }
  if (testError) throw testError;
  if (sessionErrors.length === 1) throw sessionErrors[0];
  if (cleanupError) throw new Error("OLD EDGE compatibility fixture cleanup failed.", { cause: cleanupError });
}

async function runMetricsConcurrencyTest() {
  const runToken = randomUUID().replaceAll("-", "");
  const hackathonId = `hackathon-concurrency-${runToken}`;
  const managerApplicationName = `g2_r1_manager_${runToken}`;
  const metricsApplicationName = `g2_r1_metrics_${runToken}`;
  console.log("Starting DBH-05 deterministic two-connection concurrency test...");

  let managerPromise;
  let metricsPromise;
  let testError;

  try {
    // 1. Setup initial contest row
    await runLocalSql(
      `
      INSERT INTO public.hackathons (id, status, document)
      VALUES (
        '${hackathonId}',
        'published',
        jsonb_build_object(
          'title', 'Original Concurrent Title',
          'description', 'Original Description',
          'created_by', '11111111-1111-4111-8111-111111111111',
          'max_participants', 100,
          'metrics_snapshot', jsonb_build_object('registrations_total', 0, 'submissions_total', 0)
        )
      )
      ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document;
      `,
    );

    // 2. Connection 1 updates the row, holds its row lock, and exposes a unique
    // application_name while waiting. The wait creates a bounded observation
    // window; pg_blocking_pids below is the proof that Connection 2 overlaps and
    // is blocked by this exact transaction in the critical region.
    const managerSql = `
      DO $manager$
      BEGIN
        PERFORM set_config('application_name', '${managerApplicationName}', true);
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
        UPDATE public.hackathons
        SET document = jsonb_set(
          jsonb_set(document, '{title}', '"MANAGER_CONCURRENT_TITLE_UPDATED"'),
          '{description}', '"MANAGER_CONCURRENT_DESC_UPDATED"'
        )
        WHERE id = '${hackathonId}';
        PERFORM pg_sleep(5);
      END
      $manager$;
      `;

    const metricsSql = `
      DO $metrics$
      BEGIN
        PERFORM set_config('application_name', '${metricsApplicationName}', true);
        PERFORM set_config('role', 'authenticated', true);
        PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
        PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
        PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
        PERFORM public.patch_hackathon_metrics_snapshot(
          '${hackathonId}',
          '{"registrations_total": 77, "submissions_total": 19, "updated_at": "2026-08-24T00:00:00Z"}'::jsonb
        );
      END
      $metrics$;
      `;

    managerPromise = runLocalSql(managerSql);
    managerPromise.catch(() => {});

    await waitForDatabaseCondition(
      `
      DO $probe$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_stat_activity
          WHERE application_name = '${managerApplicationName}'
            AND state = 'active'
            AND wait_event_type = 'Timeout'
            AND wait_event = 'PgSleep'
            AND xact_start IS NOT NULL
        ) THEN
          RAISE EXCEPTION 'MANAGER_ROW_LOCK_NOT_READY';
        END IF;
      END
      $probe$;
      `,
      "Manager transaction holding the hackathon row lock",
    );

    metricsPromise = runLocalSql(metricsSql);
    metricsPromise.catch(() => {});

    await waitForDatabaseCondition(
      `
      DO $probe$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_stat_activity AS metrics
          JOIN pg_stat_activity AS manager
            ON manager.application_name = '${managerApplicationName}'
           AND manager.pid = ANY(pg_blocking_pids(metrics.pid))
          WHERE metrics.application_name = '${metricsApplicationName}'
            AND metrics.state = 'active'
            AND metrics.wait_event_type = 'Lock'
        ) THEN
          RAISE EXCEPTION 'DETERMINISTIC_ROW_LOCK_OVERLAP_NOT_OBSERVED';
        END IF;
      END
      $probe$;
      `,
      "Metrics RPC blocked by the manager transaction on the shared hackathon row",
    );

    console.log("✓ CONCURRENCY-BARRIER: PASS (pg_blocking_pids confirmed deterministic row-lock overlap)");
    await Promise.all([managerPromise, metricsPromise]);

    // 3. Assert the exact final document state in PostgreSQL.
    await runLocalSql(
      `
      DO $verify$
      DECLARE
        v_document jsonb;
      BEGIN
        SELECT document INTO STRICT v_document
        FROM public.hackathons
        WHERE id = '${hackathonId}';

        IF v_document->>'title' IS DISTINCT FROM 'MANAGER_CONCURRENT_TITLE_UPDATED' THEN
          RAISE EXCEPTION 'Manager title edit was lost: %', v_document->>'title';
        END IF;
        IF v_document->>'description' IS DISTINCT FROM 'MANAGER_CONCURRENT_DESC_UPDATED' THEN
          RAISE EXCEPTION 'Manager description edit was lost: %', v_document->>'description';
        END IF;
        IF (v_document #>> '{metrics_snapshot,registrations_total}')::integer IS DISTINCT FROM 77 THEN
          RAISE EXCEPTION 'registrations_total mismatch: %', v_document #>> '{metrics_snapshot,registrations_total}';
        END IF;
        IF (v_document #>> '{metrics_snapshot,submissions_total}')::integer IS DISTINCT FROM 19 THEN
          RAISE EXCEPTION 'submissions_total mismatch: %', v_document #>> '{metrics_snapshot,submissions_total}';
        END IF;
      END
      $verify$;
      `,
    );

    console.log("✓ CONCURRENCY-01: PASS (Deterministic row-lock overlap preserved manager edits and atomic metrics patch)");
  } catch (error) {
    testError = error;
  }

  // Do not delete the fixture while either database session may still be using it.
  const sessionResults = await Promise.allSettled([managerPromise, metricsPromise].filter(Boolean));
  const sessionErrors = sessionResults
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason);

  let cleanupError;
  try {
    await runLocalSql(`DELETE FROM public.hackathons WHERE id = '${hackathonId}';`);
  } catch (error) {
    cleanupError = error;
  }

  const errors = [testError, ...sessionErrors, cleanupError].filter(Boolean);
  if (errors.length > 1) {
    throw new AggregateError(errors, "Concurrency test, database sessions, or fixture cleanup failed.");
  }
  if (testError) throw testError;
  if (sessionErrors.length === 1) throw sessionErrors[0];
  if (cleanupError) throw new Error("Concurrency fixture cleanup failed.", { cause: cleanupError });
}

export async function runConcurrencyTest() {
  await runOldEdgeCompatibilityConcurrencyTest();
  await runMetricsConcurrencyTest();
}

// Run directly if invoked as script
if (process.argv[1]?.endsWith("g2-r1-concurrency.integration.mjs")) {
  runConcurrencyTest().catch((err) => {
    console.error("CONCURRENCY_TEST_FAILED:", err);
    process.exit(1);
  });
}
