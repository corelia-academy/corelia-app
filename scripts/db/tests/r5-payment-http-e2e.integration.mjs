import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const projectId = "corelia-app";
const dbContainer = `supabase_db_${projectId}`;
const tempDir = mkdtempSync(join(tmpdir(), "corelia-r5-http-"));
const envPath = join(tempDir, "edge.env");
const ipnSecret = randomBytes(32).toString("hex");
let edgeProcess;
let edgeOutput = "";

function fail(message) {
  throw new Error(message);
}

function parseStatusEnv() {
  const result = spawnSync(command, ["exec", "supabase", "status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    windowsHide: true,
  });
  if (result.status !== 0) fail("R5 HTTP E2E could not read local Supabase status.");
  const values = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"([^"]*)"|(.*))$/);
    if (match) values[match[1]] = match[2] ?? match[3] ?? "";
  }
  if (!values.API_URL || !values.SECRET_KEY) {
    fail("R5 HTTP E2E local API URL or secret key is unavailable.");
  }
  return values;
}

function runSql(sql) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", dbContainer, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tA", "-f", "-"],
    { input: sql, encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0) fail(`R5 HTTP E2E SQL failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

async function waitForHealth(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (edgeProcess?.exitCode != null) {
      fail(`R5 HTTP E2E Edge runtime exited early (${edgeProcess.exitCode}).`);
    }
    try {
      const response = await fetch(`${url}?op=health`);
      if (response.status === 200 && (await response.json()).ok === true) return;
    } catch {
      // Runtime is still starting.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  fail("R5 HTTP E2E Edge runtime did not become healthy before timeout.");
}

async function postIpn(url, secret, invoice, amount, notificationType = "ORDER_PAID") {
  const response = await fetch(`${url}?op=payments.sepay.ipn`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-secret-key": secret,
    },
    body: JSON.stringify({
      notification_type: notificationType,
      order: {
        order_invoice_number: invoice,
        order_amount: String(amount),
      },
    }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

const token = randomUUID().replaceAll("-", "");
const buyer = randomUUID();
const instructor = randomUUID();
const courseId = `r5-http-course-${token}`;
const repairCourseId = `r5-http-repair-course-${token}`;
const validTx = `R5-HTTP-VALID-${token}`;
const paidRepairTx = `R5-HTTP-PAID-REPAIR-${token}`;
const failedTx = `R5-HTTP-FAILED-${token}`;
const mismatchTx = `R5-HTTP-MISMATCH-${token}`;
const aiPendingTx = `R5-HTTP-AI-PENDING-${token}`;
const aiPaidTx = `R5-HTTP-AI-PAID-${token}`;
const amount = 275000;

try {
  const local = parseStatusEnv();
  const localApiForEdge = local.API_URL.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal");
  writeFileSync(
    envPath,
    [
      `CORELIA_SUPABASE_URL=${localApiForEdge}`,
      `CORELIA_SUPABASE_SECRET_KEYS=${local.SECRET_KEY}`,
      `SEPAY_IPN_SECRET=${ipnSecret}`,
      "PAYMENT_CALLBACK_ALLOWED_ORIGINS=http://localhost:3000",
      "",
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 },
  );

  runSql(`
    INSERT INTO auth.users (id, email, role, aud, raw_app_meta_data, raw_user_meta_data)
    VALUES
      ('${buyer}', 'r5-http-buyer-${token}@test.local', 'authenticated', 'authenticated', '{}', '{}'),
      ('${instructor}', 'r5-http-instructor-${token}@test.local', 'authenticated', 'authenticated', '{}', '{}');
    INSERT INTO public.courses (id, instructor_id, published, slug, data)
    VALUES
      ('${courseId}', '${instructor}', true, '${courseId}', '{"access_model":"paid_upfront"}'),
      ('${repairCourseId}', '${instructor}', true, '${repairCourseId}', '{"access_model":"paid_upfront"}');
    INSERT INTO public.payment_transactions
      (id, user_id, course_id, purpose, amount_vnd, provider, status, created_at, updated_at)
    VALUES
      ('${validTx}', '${buyer}', '${courseId}', 'course_purchase', ${amount}, 'sepay', 'pending', now(), now()),
      ('${paidRepairTx}', '${buyer}', '${repairCourseId}', 'course_purchase', ${amount}, 'sepay', 'paid', now() - interval '2 minutes', now() - interval '2 minutes'),
      ('${failedTx}', '${buyer}', '${courseId}', 'course_purchase', ${amount}, 'sepay', 'failed', now(), now()),
      ('${mismatchTx}', '${buyer}', '${courseId}', 'course_purchase', ${amount}, 'sepay', 'pending', now(), now()),
      ('${aiPendingTx}', '${buyer}', 'cora-ai', 'ai_subscription', 199000, 'sepay', 'pending', now(), now()),
      ('${aiPaidTx}', '${buyer}', 'cora-ai', 'ai_subscription', 199000, 'sepay', 'paid', now() - interval '90 days', now() - interval '90 days');
  `);

  edgeProcess = spawn(
    command,
    ["exec", "supabase", "functions", "serve", "corelia-api", "--env-file", envPath, "--no-verify-jwt"],
    { cwd: resolve(process.cwd()), shell: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const collect = (chunk) => {
    edgeOutput = (edgeOutput + String(chunk)).slice(-20_000);
  };
  edgeProcess.stdout.on("data", collect);
  edgeProcess.stderr.on("data", collect);

  const functionUrl = `${local.API_URL}/functions/v1/corelia-api`;
  await waitForHealth(functionUrl);

  const invalidSecret = await postIpn(functionUrl, "invalid-r5-secret", validTx, amount);
  if (invalidSecret.status !== 401) fail(`HTTP-PAY-01 expected 401, got ${invalidSecret.status}.`);
  if (runSql(`SELECT status || ':' || (SELECT count(*) FROM public.course_payment_access WHERE full_access_transaction_id='${validTx}') FROM public.payment_transactions WHERE id='${validTx}';`) !== "pending:0") {
    fail("HTTP-PAY-01 invalid signature mutated payment/access state.");
  }
  console.log("HTTP-PAY-01 PASS (invalid signature rejected; zero DB mutation)");

  const valid = await postIpn(functionUrl, ipnSecret, validTx, amount);
  if (valid.status !== 200 || valid.body.ok !== true) fail(`HTTP-PAY-02 valid callback failed (${valid.status}).`);
  const validState = runSql(`
    SELECT concat_ws(':',
      t.status,
      (SELECT count(*) FROM public.course_payment_access a WHERE a.full_access_transaction_id=t.id AND a.full_access_granted AND a.status='active'),
      (SELECT count(*) FROM public.enrollments e WHERE e.paid_order_id=t.id),
      (SELECT count(*) FROM public.course_payment_access a WHERE a.source_transaction_id=t.id)
    ) FROM public.payment_transactions t WHERE t.id='${validTx}';
  `);
  if (validState !== "paid:1:1:1") fail(`HTTP-PAY-02 settlement invariant failed: ${validState}.`);
  console.log("HTTP-PAY-02 PASS (valid callback settled payment/access/enrollment/provenance)");

  const duplicate = await postIpn(functionUrl, ipnSecret, validTx, amount);
  if (duplicate.status !== 200 || duplicate.body.ok !== true) fail(`HTTP-PAY-03 duplicate callback failed (${duplicate.status}).`);
  const duplicateState = runSql(`
    SELECT concat_ws(':',
      (SELECT count(*) FROM public.course_payment_access WHERE full_access_transaction_id='${validTx}'),
      (SELECT count(*) FROM public.enrollments WHERE paid_order_id='${validTx}'),
      (SELECT count(*) FROM public.payment_refunds WHERE payment_transaction_id='${validTx}')
    );
  `);
  if (duplicateState !== "1:1:0") fail(`HTTP-PAY-03 duplicate mutation detected: ${duplicateState}.`);
  console.log("HTTP-PAY-03 PASS (duplicate callback idempotent)");

  const unknown = await postIpn(functionUrl, ipnSecret, `R5-UNKNOWN-${token}`, amount);
  if (unknown.status !== 404 || unknown.body.code !== "PAYMENT_TRANSACTION_NOT_FOUND") {
    fail(`HTTP-PAY-04 unknown invoice did not fail closed (${unknown.status}).`);
  }
  console.log("HTTP-PAY-04 PASS (unknown transaction fails closed)");

  const paidRepair = await postIpn(functionUrl, ipnSecret, paidRepairTx, amount);
  if (paidRepair.status !== 200 || paidRepair.body.ok !== true) fail(`HTTP-PAY-05 paid retry failed (${paidRepair.status}).`);
  const repairState = runSql(`
    SELECT concat_ws(':',
      (SELECT count(*) FROM public.course_payment_access WHERE full_access_transaction_id='${paidRepairTx}'),
      (SELECT count(*) FROM public.enrollments WHERE paid_order_id='${paidRepairTx}')
    );
  `);
  if (repairState !== "1:1") fail(`HTTP-PAY-05 paid retry did not repair effects: ${repairState}.`);
  console.log("HTTP-PAY-05 PASS (paid retry repairs missing effects atomically)");

  const invalidState = await postIpn(functionUrl, ipnSecret, failedTx, amount);
  if (invalidState.status !== 500) fail(`HTTP-PAY-06 invalid state expected deterministic rejection, got ${invalidState.status}.`);
  if (runSql(`SELECT status || ':' || (SELECT count(*) FROM public.course_payment_access WHERE full_access_transaction_id='${failedTx}') FROM public.payment_transactions WHERE id='${failedTx}';`) !== "failed:0") {
    fail("HTTP-PAY-06 invalid state resurrected payment/access.");
  }
  console.log("HTTP-PAY-06 PASS (failed transaction cannot resurrect)");

  const mismatch = await postIpn(functionUrl, ipnSecret, mismatchTx, amount + 1);
  if (mismatch.status !== 400) fail(`HTTP-PAY-07 amount mismatch expected 400, got ${mismatch.status}.`);
  if (runSql(`SELECT status FROM public.payment_transactions WHERE id='${mismatchTx}';`) !== "pending") {
    fail("HTTP-PAY-07 amount mismatch mutated transaction.");
  }
  console.log("HTTP-PAY-07 PASS (amount mismatch rejected; zero mutation)");

  for (const [label, txId, expectedStatus] of [
    ["HTTP-PAY-08", aiPendingTx, "pending"],
    ["HTTP-PAY-09", aiPaidTx, "paid"],
  ]) {
    const aiResponse = await postIpn(functionUrl, ipnSecret, txId, 199000);
    if (aiResponse.status !== 409 || aiResponse.body.code !== "AI_SUBSCRIPTION_RETIRED") {
      fail(`${label} AI callback did not return retired-service rejection (${aiResponse.status}).`);
    }
    const aiState = runSql(`
      SELECT concat_ws(':', status,
        (SELECT count(*) FROM public.ai_subscriptions WHERE payment_transaction_id='${txId}'),
        (SELECT count(*) FROM public.ai_voucher_redemptions WHERE payment_transaction_id='${txId}')
      ) FROM public.payment_transactions WHERE id='${txId}';
    `);
    if (aiState !== `${expectedStatus}:0:0`) fail(`${label} AI callback changed history/entitlement: ${aiState}.`);
    console.log(`${label} PASS (AI ${expectedStatus} callback rejected; history preserved; zero entitlement)`);
  }

  const aiRefund = await postIpn(functionUrl, ipnSecret, aiPaidTx, 199000, "ORDER_REFUND");
  if (aiRefund.status !== 200 || aiRefund.body.ok !== true) {
    fail(`HTTP-PAY-10 historical AI refund callback failed (${aiRefund.status}).`);
  }
  const aiRefundState = runSql(`
    SELECT concat_ws(':', status,
      (SELECT count(*) FROM public.payment_refunds WHERE payment_transaction_id='${aiPaidTx}' AND status='completed'),
      (SELECT count(*) FROM public.ai_subscriptions WHERE payment_transaction_id='${aiPaidTx}')
    ) FROM public.payment_transactions WHERE id='${aiPaidTx}';
  `);
  if (aiRefundState !== "refunded:1:0") fail(`HTTP-PAY-10 historical AI refund invariant failed: ${aiRefundState}.`);
  console.log("HTTP-PAY-10 PASS (provider refund remains supported; zero AI reactivation)");

  console.log("R5 LOCAL HTTP E2E PASS (10/10 real Request/router/signature/DB cases)");
} catch (error) {
  const safeOutput = edgeOutput
    .replaceAll(ipnSecret, "[REDACTED]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[REDACTED]");
  if (safeOutput.trim()) console.error(safeOutput.trim());
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (edgeProcess && edgeProcess.exitCode == null) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(edgeProcess.pid), "/T", "/F"], {
        encoding: "utf8",
        windowsHide: true,
      });
    } else {
      edgeProcess.kill("SIGTERM");
      await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      if (edgeProcess.exitCode == null) edgeProcess.kill("SIGKILL");
    }
  }
  spawnSync("docker", ["stop", `supabase_edge_runtime_${projectId}`], {
    encoding: "utf8",
    windowsHide: true,
  });
  try {
    runSql(`
      DELETE FROM public.payment_refunds WHERE payment_transaction_id IN ('${validTx}', '${paidRepairTx}', '${failedTx}', '${mismatchTx}', '${aiPendingTx}', '${aiPaidTx}');
      DELETE FROM public.enrollments WHERE user_id='${buyer}' AND course_id IN ('${courseId}', '${repairCourseId}');
      DELETE FROM public.course_payment_access WHERE user_id='${buyer}' AND course_id IN ('${courseId}', '${repairCourseId}');
      DELETE FROM public.payment_transactions WHERE id IN ('${validTx}', '${paidRepairTx}', '${failedTx}', '${mismatchTx}', '${aiPendingTx}', '${aiPaidTx}');
      DELETE FROM public.courses WHERE id IN ('${courseId}', '${repairCourseId}');
      DELETE FROM auth.users WHERE id IN ('${buyer}', '${instructor}');
    `);
  } catch (cleanupError) {
    console.error(`R5 HTTP E2E cleanup failed: ${cleanupError.message}`);
    process.exitCode = 1;
  }
  rmSync(tempDir, { recursive: true, force: true });
}
