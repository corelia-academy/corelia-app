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
import { corsHeadersForRequest, json, withCors } from "./lib/http.ts";
import { createServiceClient, type SupabaseClient } from "./lib/supabase.ts";
import {
  handleMyPaymentTransactions,
  handleSePayDebugLookup,
  handleSePayCheckout,
  handleSePayIpn,
  handleVerifySePayPayment,
} from "./payments/handlers.ts";

const PROTECTED_OPS = new Set<string>([
  "payments.sepay.checkout",
  "payments.transactions",
  "payments.sepay.debugLookup",
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
  const cors = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    if (!cors) return json({ message: "Origin not allowed" }, 403);
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const url = new URL(req.url);
    const op = url.searchParams.get("op") ?? "";
    if (PROTECTED_OPS.has(op) && !hasBearerAuthHeader(req)) {
      return withCors(req, json({ message: "Missing Authorization header" }, 401));
    }
    let db: SupabaseClient;
    try {
      db = createServiceClient();
    } catch (e) {
      console.error("[corelia-api] boot", e);
      return withCors(req, json({ message: "Server misconfiguration" }, 500));
    }

    let response: Response;
    if (op === "health" && req.method === "GET") {
      response = json({ ok: true });
    } else if (op === "payments.sepay.checkout" && req.method === "POST") {
      response = await handleSePayCheckout(req, db);
    } else if (op === "payments.transactions" && req.method === "GET") {
      response = await handleMyPaymentTransactions(req, db);
    } else if (op === "payments.sepay.debugLookup" && req.method === "POST") {
      response = await handleSePayDebugLookup(req, db);
    } else if (op === "certificates.issue" && req.method === "POST") {
      response = await handleIssueCertificate(req, db);
    } else if (op === "payments.sepay.verify" && req.method === "POST") {
      response = await handleVerifySePayPayment(req, db);
    } else if (op === "payments.sepay.ipn" && req.method === "POST") {
      response = await handleSePayIpn(req, db);
    } else if (op === "hackathons.notifyRegistrationReview" && req.method === "POST") {
      response = await handleHackathonNotifyRegistrationReview(req, db);
    } else if (op === "credentials.checkCourseCompletion" && req.method === "POST") {
      response = await handleCheckCourseCompletion(req, db);
    } else if (op === "credentials.checkActivityMilestones" && req.method === "POST") {
      response = await handleCheckActivityMilestones(req, db);
    } else if (op === "credentials.grant" && req.method === "POST") {
      response = await handleGrantCredentials(req, db);
    } else {
      response = json({ message: "Unknown or disallowed op / method", op }, 404);
    }

    return withCors(req, response);
  } catch (e) {
    console.error("[corelia-api] unhandled", e);
    return withCors(req, json({ message: "Unhandled server error" }, 500));
  }
});
