/**
 * Corelia API — Supabase Edge Function (Deno).
 * Invoke: GET/POST {SUPABASE_URL}/functions/v1/corelia-api?op=<operation>
 *
 * Operations: health | payments.sepay.checkout | payments.transactions |
 *   payments.sepay.verify | payments.sepay.ipn | certificates.issue |
 *   hackathons.notifyRegistrationReview |
 *   credentials.checkCourseCompletion | credentials.checkActivityMilestones | credentials.grant
 */
import { handleIssueCertificate } from "./certificates/handlers.ts";
import { handleCheckActivityMilestones } from "./credentials/check_activity.ts";
import { handleCheckCourseCompletion } from "./credentials/check_course.ts";
import { handleGrantCredentials } from "./credentials/grant.ts";
import { handleHackathonNotifyRegistrationReview } from "./hackathons/handlers.ts";
import { cors, json } from "./lib/http.ts";
import { createServiceClient, type SupabaseClient } from "./lib/supabase.ts";
import {
  handleMyPaymentTransactions,
  handleSePayCheckout,
  handleSePayIpn,
  handleVerifySePayPayment,
} from "./payments/handlers.ts";

const PROTECTED_OPS = new Set<string>([
  "payments.sepay.checkout",
  "payments.transactions",
  "certificates.issue",
  "payments.sepay.verify",
  "hackathons.notifyRegistrationReview",
  "credentials.checkCourseCompletion",
  "credentials.checkActivityMilestones",
  "credentials.grant",
]);

function hasBearerAuthHeader(req: Request): boolean {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  return /^Bearer\s+\S+$/i.test(header ?? "");
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const url = new URL(req.url);
  const op = url.searchParams.get("op") ?? "";
  if (PROTECTED_OPS.has(op) && !hasBearerAuthHeader(req)) {
    return json({ message: "Missing Authorization header" }, 401);
  }
  let db: SupabaseClient;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error("[corelia-api] boot", e);
    return json({ message: "Server misconfiguration" }, 500);
  }
  if (op === "health" && req.method === "GET") return json({ ok: true });
  if (op === "payments.sepay.checkout" && req.method === "POST") {
    return await handleSePayCheckout(req, db);
  }
  if (op === "payments.transactions" && req.method === "GET") {
    return await handleMyPaymentTransactions(req, db);
  }
  if (op === "certificates.issue" && req.method === "POST") {
    return await handleIssueCertificate(req, db);
  }
  if (op === "payments.sepay.verify" && req.method === "POST") {
    return await handleVerifySePayPayment(req, db);
  }
  if (op === "payments.sepay.ipn" && req.method === "POST") {
    return await handleSePayIpn(req, db);
  }
  if (op === "hackathons.notifyRegistrationReview" && req.method === "POST") {
    return await handleHackathonNotifyRegistrationReview(req, db);
  }
  if (op === "credentials.checkCourseCompletion" && req.method === "POST") {
    return await handleCheckCourseCompletion(req, db);
  }
  if (op === "credentials.checkActivityMilestones" && req.method === "POST") {
    return await handleCheckActivityMilestones(req, db);
  }
  if (op === "credentials.grant" && req.method === "POST") {
    return await handleGrantCredentials(req, db);
  }
  return json({ message: "Unknown or disallowed op / method", op }, 404);
});
