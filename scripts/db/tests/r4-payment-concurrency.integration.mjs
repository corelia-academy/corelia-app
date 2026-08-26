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
    SELECT public.process_payment_refund('${refundTx}', 200000, 'concurrent refund', '${instructor}', '{}');
    SELECT pg_sleep(2);
    COMMIT;
  `;
  const refundResults = await Promise.allSettled([runLocalSql(refundCall), runLocalSql(refundCall)]);
  const fulfilled = refundResults.filter((result) => result.status === "fulfilled").length;
  const rejected = refundResults.filter((result) => result.status === "rejected").length;
  if (fulfilled !== 1 || rejected !== 1) {
    throw new Error(`REF-INT-04 expected one success and one rejection, got ${fulfilled}/${rejected}.`);
  }
  await runLocalSql(`
    DO $verify$
    BEGIN
      IF (SELECT COALESCE(sum(amount_vnd), 0) FROM public.payment_refunds WHERE payment_transaction_id = '${refundTx}' AND status = 'completed') <> 200000
         OR (SELECT status FROM public.payment_transactions WHERE id = '${refundTx}') <> 'partially_refunded'
         OR NOT EXISTS (
           SELECT 1 FROM public.course_payment_access
           WHERE full_access_transaction_id = '${refundTx}' AND full_access_granted = true AND status = 'active'
         ) THEN
        RAISE EXCEPTION 'REF-INT-04: concurrent refund invariant failed';
      END IF;
    END
    $verify$;
  `);
  console.log("REF-INT-04 PASS (row lock prevented cumulative over-refund)");
} finally {
  await runLocalSql(`
    DELETE FROM public.payment_refunds WHERE payment_transaction_id IN ('${settleTx}', '${refundTx}');
    DELETE FROM public.enrollments WHERE user_id = '${buyer}' AND course_id IN ('${settleCourse}', '${refundCourse}');
    DELETE FROM public.course_payment_access WHERE user_id = '${buyer}' AND course_id IN ('${settleCourse}', '${refundCourse}');
    DELETE FROM public.payment_transactions WHERE id IN ('${settleTx}', '${refundTx}');
    DELETE FROM public.courses WHERE id IN ('${settleCourse}', '${refundCourse}');
    DELETE FROM auth.users WHERE id IN ('${buyer}', '${instructor}');
  `).catch((error) => {
    console.error("R4 concurrency cleanup failed:", error.message);
  });
}

