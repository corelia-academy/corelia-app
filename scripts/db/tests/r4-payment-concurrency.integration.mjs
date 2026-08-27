import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const configText = readFileSync(resolve(process.cwd(), "supabase", "config.toml"), "utf8");
const projectId = configText.match(/^\s*project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
if (!projectId) throw new Error("Unable to resolve local Supabase project_id.");
const localDbContainer = `supabase_db_${projectId}`;

function runLocalSql(sql, timeout = 30_000) {
  return new Promise((resolveQuery, rejectQuery) => {
    const child = spawn(
      "docker",
      ["exec", "-i", localDbContainer, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-f", "-"],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      rejectQuery(new Error(`R4 local SQL command exceeded ${timeout}ms.`));
    }, timeout);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectQuery(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolveQuery({ stdout, stderr });
      else rejectQuery(new Error(`R4 local SQL failed (${code}): ${stderr.trim()}`));
    });
    child.stdin.end(sql);
  });
}

const token = randomUUID().replaceAll("-", "");
const buyer = randomUUID();
const instructor = randomUUID();
const settleCourse = `r4-concurrent-settle-${token}`;
const refundCourse = `r4-concurrent-refund-${token}`;
const settleTx = `R4-CONCURRENT-SETTLE-${token}`;
const refundTx = `R4-CONCURRENT-REFUND-${token}`;

try {
  await runLocalSql(`
    INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
    VALUES
      ('${buyer}', 'r4-concurrent-buyer-${token}@test.local', 'authenticated', 'authenticated', '{}', '{}'),
      ('${instructor}', 'r4-concurrent-instructor-${token}@test.local', 'authenticated', 'authenticated', '{}', '{}');
    INSERT INTO public.profiles (id, role, full_name, email)
    VALUES
      ('${instructor}', 'admin', 'R4 Instructor', 'r4-concurrent-instructor-${token}@test.local')
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;
    INSERT INTO public.courses (id, instructor_id, published, slug, data)
    VALUES
      ('${settleCourse}', '${instructor}', true, '${settleCourse}', '{"access_model":"paid_upfront"}'),
      ('${refundCourse}', '${instructor}', true, '${refundCourse}', '{"access_model":"paid_upfront"}');
    INSERT INTO public.payment_transactions
      (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
    VALUES
      ('${settleTx}', '${buyer}', '${settleCourse}', 'course_purchase', 300000, 'sepay', 'pending', now(), now()),
      ('${refundTx}', '${buyer}', '${refundCourse}', 'course_purchase', 300000, 'sepay', 'pending', now(), now());
  `);

  const settleCall = `
    BEGIN;
    SELECT public.process_successful_payment('${settleTx}', '{}', now());
    SELECT pg_sleep(2);
    COMMIT;
  `;
  const settlementResults = await Promise.all([runLocalSql(settleCall), runLocalSql(settleCall)]);
  if (settlementResults.length !== 2) throw new Error("PAY-INT-09 did not execute two connections.");
  await runLocalSql(`
    DO $verify$
    BEGIN
      IF (SELECT status FROM public.payment_transactions WHERE id = '${settleTx}') <> 'paid'
         OR (SELECT count(*) FROM public.course_payment_access WHERE full_access_transaction_id = '${settleTx}') <> 1
         OR (SELECT count(*) FROM public.enrollments WHERE paid_order_id = '${settleTx}') <> 1 THEN
        RAISE EXCEPTION 'PAY-INT-09: concurrent settlement invariant failed';
      END IF;
    END
    $verify$;
  `);
  console.log("PAY-INT-09 PASS (two real connections; one access and one enrollment)");

  await runLocalSql(`SELECT public.process_successful_payment('${refundTx}', '{}', now());`);
  const refundCall = `
    BEGIN;
    SELECT public.request_payment_refund('${refundTx}', 300000, 'concurrent refund', '${instructor}', '{}');
    SELECT pg_sleep(2);
    COMMIT;
  `;
  const refundResults = await Promise.allSettled([runLocalSql(refundCall), runLocalSql(refundCall)]);
  const fulfilled = refundResults.filter((result) => result.status === "fulfilled").length;
  if (fulfilled !== 2) {
    throw new Error(`REF-INT-04 expected both concurrent refund requests to settle/replay idempotently, got ${fulfilled}/2.`);
  }
  await runLocalSql(`
    DO $verify$
    BEGIN
      IF (SELECT count(*) FROM public.payment_refunds WHERE payment_transaction_id = '${refundTx}' AND status = 'requested') <> 1
         OR (SELECT status FROM public.payment_transactions WHERE id = '${refundTx}') <> 'refund_requested'
         OR NOT EXISTS (
           SELECT 1 FROM public.course_payment_access
           WHERE full_access_transaction_id = '${refundTx}' AND full_access_granted = true AND status = 'active'
         ) THEN
        RAISE EXCEPTION 'REF-INT-04: concurrent refund request invariant failed';
      END IF;
    END
    $verify$;
  `);
  console.log("REF-INT-04 PASS (concurrent refund requests result in exactly one requested ledger row and refund_requested status)");

  // ---------------------------------------------------------------------------
  // CONC-RACE-01: Concurrent Payment Settlement vs Admin Grant on SAME user & course
  // ---------------------------------------------------------------------------
  const raceCourse = `r4-race-course-${token}`;
  const raceTx = `R4-RACE-TX-${token}`;
  await runLocalSql(`
    INSERT INTO public.courses (id, instructor_id, published, slug, data)
    VALUES ('${raceCourse}', '${instructor}', true, '${raceCourse}', '{"access_model":"paid_upfront"}');
    INSERT INTO public.payment_transactions
      (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
    VALUES
      ('${raceTx}', '${buyer}', '${raceCourse}', 'course_purchase', 300000, 'sepay', 'pending', now(), now());
  `);

  const raceSettleSql = `
    BEGIN;
    SELECT public.process_successful_payment('${raceTx}', '{}', now());
    SELECT pg_sleep(1);
    COMMIT;
  `;
  const raceAdminGrantSql = `
    BEGIN;
    SELECT public.grant_course_access_admin('${buyer}', '${raceCourse}', true, 'Concurrent Admin Grant', '${instructor}');
    SELECT pg_sleep(1);
    COMMIT;
  `;

  const raceResults = await Promise.allSettled([runLocalSql(raceSettleSql), runLocalSql(raceAdminGrantSql)]);
  if (raceResults.some((r) => r.status === "rejected")) {
    throw new Error(`CONC-RACE-01 execution failed: ${raceResults.map((r) => r.reason?.message).join("; ")}`);
  }

  await runLocalSql(`
    DO $verify_race$
    DECLARE
      v_active_count int;
      v_grant_source text;
    BEGIN
      -- Invariant 1: Exactly 1 active entitlement exists for this (user, course)
      SELECT count(*) INTO v_active_count
      FROM public.course_entitlement_grants
      WHERE user_id = '${buyer}' AND course_id = '${raceCourse}' AND status = 'active';

      IF v_active_count <> 1 THEN
        RAISE EXCEPTION 'CONC-RACE-01: Expected exactly 1 active entitlement, found %', v_active_count;
      END IF;

      SELECT source INTO v_grant_source
      FROM public.course_entitlement_grants
      WHERE user_id = '${buyer}' AND course_id = '${raceCourse}' AND status = 'active';

      -- Invariant 2: If admin grant won, payment is refund_requested and item is conflict.
      -- If payment won, admin grant returned already_entitled.
      IF v_grant_source = 'admin_grant' THEN
        IF (SELECT status FROM public.payment_transactions WHERE id = '${raceTx}') <> 'refund_requested'
           OR (SELECT fulfillment_status FROM public.payment_transaction_items WHERE payment_transaction_id = '${raceTx}') <> 'conflict' THEN
          RAISE EXCEPTION 'CONC-RACE-01: Admin won race but payment was not cleanly transitioned to conflict refund.';
        END IF;
      ELSE
        IF (SELECT status FROM public.payment_transactions WHERE id = '${raceTx}') <> 'paid'
           OR (SELECT fulfillment_status FROM public.payment_transaction_items WHERE payment_transaction_id = '${raceTx}') <> 'fulfilled' THEN
          RAISE EXCEPTION 'CONC-RACE-01: Payment won race but fulfillment was not fulfilled.';
        END IF;
      END IF;
    END
    $verify_race$;
  `);
  console.log("CONC-RACE-01 PASS (Concurrent settlement vs admin grant serialized on advisory lock without duplicate active entitlement)");

  // ---------------------------------------------------------------------------
  // CONC-RACE-02: Concurrent Two Admin Grants on same target user & course
  // ---------------------------------------------------------------------------
  const raceAdminCourse = `r4-race-admin-course-${token}`;
  await runLocalSql(`
    INSERT INTO public.courses (id, instructor_id, published, slug, data)
    VALUES ('${raceAdminCourse}', '${instructor}', true, '${raceAdminCourse}', '{"access_model":"paid_upfront"}');
  `);

  const doubleAdminCall = `
    BEGIN;
    SELECT public.grant_course_access_admin('${buyer}', '${raceAdminCourse}', true, 'Double Admin Grant', '${instructor}');
    SELECT pg_sleep(1);
    COMMIT;
  `;

  const doubleAdminResults = await Promise.allSettled([runLocalSql(doubleAdminCall), runLocalSql(doubleAdminCall)]);
  if (doubleAdminResults.some((r) => r.status === "rejected")) {
    throw new Error(`CONC-RACE-02 execution failed: ${doubleAdminResults.map((r) => r.reason?.message).join("; ")}`);
  }

  await runLocalSql(`
    DO $verify_double_admin$
    BEGIN
      IF (SELECT count(*) FROM public.course_entitlement_grants WHERE user_id = '${buyer}' AND course_id = '${raceAdminCourse}' AND status = 'active') <> 1 THEN
        RAISE EXCEPTION 'CONC-RACE-02: Duplicate active entitlement created by concurrent admin grants.';
      END IF;
    END
    $verify_double_admin$;
  `);
  console.log("CONC-RACE-02 PASS (Concurrent duplicate admin grants serialized cleanly with exactly 1 active grant)");
} finally {
  await runLocalSql(`
    DELETE FROM public.payment_refunds WHERE payment_transaction_id IN ('${settleTx}', '${refundTx}') OR payment_transaction_id LIKE 'R4-RACE-%';
    DELETE FROM public.course_entitlement_grants WHERE user_id = '${buyer}' AND (course_id IN ('${settleCourse}', '${refundCourse}') OR course_id LIKE 'r4-race-%' OR source_transaction_id IN ('${settleTx}', '${refundTx}') OR source_transaction_id LIKE 'R4-RACE-%');
    DELETE FROM public.course_payment_access WHERE user_id = '${buyer}' AND (course_id IN ('${settleCourse}', '${refundCourse}') OR course_id LIKE 'r4-race-%');
    DELETE FROM public.enrollments WHERE user_id = '${buyer}' AND (course_id IN ('${settleCourse}', '${refundCourse}') OR course_id LIKE 'r4-race-%');
    DELETE FROM public.payment_transaction_items WHERE payment_transaction_id IN ('${settleTx}', '${refundTx}') OR payment_transaction_id LIKE 'R4-RACE-%';
    DELETE FROM public.payment_transactions WHERE id IN ('${settleTx}', '${refundTx}') OR id LIKE 'R4-RACE-%';
    DELETE FROM public.courses WHERE id IN ('${settleCourse}', '${refundCourse}') OR id LIKE 'r4-race-%';
    DELETE FROM public.profiles WHERE id IN ('${buyer}', '${instructor}');
    DELETE FROM auth.users WHERE id IN ('${buyer}', '${instructor}');
  `).catch((error) => {
    console.error("R4 concurrency cleanup failed:", error.message);
  });
}
