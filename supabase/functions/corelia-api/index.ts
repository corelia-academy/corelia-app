/**
 * Corelia API — Supabase Edge Function (Deno).
 * Invoke: GET/POST {SUPABASE_URL}/functions/v1/corelia-api?op=<operation>
 *
 * Operations: health | payments.sepay.checkout | payments.transactions |
 *   payments.sepay.verify | payments.sepay.ipn | certificates.issue | certificates.backfillEligible |
 *   hackathons.notifyRegistrationReview | hackathons.blastEmail |
 *   courses.syncCompletion | courses.blastEmail | careerTracks.blastEmail | notifications.unsubscribe |
 *   credentials.checkCourseCompletion | credentials.checkActivityMilestones | credentials.grant |
 *   credentials.retryPending | credentials.hackathon.listEligible | credentials.listActiveOcaTemplates |
 *   credentials.grantPending | credentials.claimLookup
 */
import { handleBackfillEligibleCertificates, handleIssueCertificate } from "./certificates/handlers.ts";
import { handleHackathonListEligible } from "./credentials/hackathon_eligible.ts";
import { handleCareerTrackBlastEmail } from "./career-tracks/blast_email.ts";
import { handleCheckActivityMilestones } from "./credentials/check_activity.ts";
import { handleCheckCourseCompletion } from "./credentials/check_course.ts";
import { handleClaimLookup } from "./credentials/claim_lookup.ts";
import { handleGrantCredentials } from "./credentials/grant.ts";
import { handleListActiveOcaTemplates } from "./credentials/list_active_oca_templates.ts";
import { handleGrantPendingCredential } from "./credentials/grant_pending.ts";
import { handleRetryPendingCredentials } from "./credentials/retry_pending.ts";
import { handleCourseBlastEmail } from "./courses/blast_email.ts";
import { handleCoInstructorInviteEmail } from "./courses/co_instructor_invite_email.ts";
import { handleSyncCourseCompletion } from "./courses/completion.ts";
import { handleHackathonBlastEmail } from "./hackathons/blast_email.ts";
import { handleHackathonNotifyRegistrationReview } from "./hackathons/handlers.ts";
import { corsHeadersForRequest, json, withCors } from "./lib/http.ts";
import { handleNotificationsUnsubscribe } from "./notifications/unsubscribe.ts";
import { createServiceClient, type SupabaseClient } from "./lib/supabase.ts";
import {
  handleAiVoucherPreview,
  handleAiVoucherBatchCreate,
  handleAiVoucherBatchDelete,
  handleMyPaymentTransactions,
  handleSePayDebugLookup,
  handleSePayCheckout,
  handleSePayIpn,
  handleVerifySePayPayment,
} from "./payments/handlers.ts";

const PROTECTED_OPS = new Set<string>([
  "payments.sepay.checkout",
  "payments.ai.voucher.preview",
  "payments.ai.vouchers.batchCreate",
  "payments.ai.vouchers.batchDelete",
  "payments.transactions",
  "payments.sepay.debugLookup",
  "certificates.issue",
  "certificates.backfillEligible",
  "payments.sepay.verify",
  "hackathons.notifyRegistrationReview",
  "hackathons.blastEmail",
  "courses.syncCompletion",
  "courses.blastEmail",
  "courses.coInstructorInvite.sendEmail",
  "careerTracks.blastEmail",
  // notifications.unsubscribe is PUBLIC — intentionally omitted from PROTECTED_OPS
  "credentials.checkCourseCompletion",
  "credentials.checkActivityMilestones",
  "credentials.grant",
  "credentials.retryPending",
  "credentials.hackathon.listEligible",
  "credentials.listActiveOcaTemplates",
  "credentials.grantPending",
  // credentials.claimLookup is PUBLIC — intentionally omitted from PROTECTED_OPS
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
    } else if (op === "payments.ai.voucher.preview" && req.method === "POST") {
      response = await handleAiVoucherPreview(req, db);
    } else if (op === "payments.ai.vouchers.batchCreate" && req.method === "POST") {
      response = await handleAiVoucherBatchCreate(req, db);
    } else if (op === "payments.ai.vouchers.batchDelete" && req.method === "POST") {
      response = await handleAiVoucherBatchDelete(req, db);
    } else if (op === "payments.transactions" && req.method === "GET") {
      response = await handleMyPaymentTransactions(req, db);
    } else if (op === "payments.sepay.debugLookup" && req.method === "POST") {
      response = await handleSePayDebugLookup(req, db);
    } else if (op === "certificates.issue" && req.method === "POST") {
      response = await handleIssueCertificate(req, db);
    } else if (op === "certificates.backfillEligible" && req.method === "POST") {
      response = await handleBackfillEligibleCertificates(req, db);
    } else if (op === "payments.sepay.verify" && req.method === "POST") {
      response = await handleVerifySePayPayment(req, db);
    } else if (op === "payments.sepay.ipn" && req.method === "POST") {
      response = await handleSePayIpn(req, db);
    } else if (op === "hackathons.notifyRegistrationReview" && req.method === "POST") {
      response = await handleHackathonNotifyRegistrationReview(req, db);
    } else if (op === "hackathons.blastEmail" && req.method === "POST") {
      response = await handleHackathonBlastEmail(req, db);
    } else if (op === "courses.syncCompletion" && req.method === "POST") {
      response = await handleSyncCourseCompletion(req, db);
    } else if (op === "courses.blastEmail" && req.method === "POST") {
      response = await handleCourseBlastEmail(req, db);
    } else if (op === "courses.coInstructorInvite.sendEmail" && req.method === "POST") {
      response = await handleCoInstructorInviteEmail(req, db);
    } else if (op === "careerTracks.blastEmail" && req.method === "POST") {
      response = await handleCareerTrackBlastEmail(req, db);
    } else if (op === "notifications.unsubscribe" && req.method === "POST") {
      response = await handleNotificationsUnsubscribe(req, db);
    } else if (op === "credentials.checkCourseCompletion" && req.method === "POST") {
      response = await handleCheckCourseCompletion(req, db);
    } else if (op === "credentials.checkActivityMilestones" && req.method === "POST") {
      response = await handleCheckActivityMilestones(req, db);
    } else if (op === "credentials.grant" && req.method === "POST") {
      response = await handleGrantCredentials(req, db);
    } else if (op === "credentials.retryPending" && req.method === "POST") {
      response = await handleRetryPendingCredentials(req, db);
    } else if (op === "credentials.hackathon.listEligible" && req.method === "POST") {
      response = await handleHackathonListEligible(req, db);
    } else if (op === "credentials.listActiveOcaTemplates" && req.method === "POST") {
      response = await handleListActiveOcaTemplates(req, db);
    } else if (op === "credentials.grantPending" && req.method === "POST") {
      response = await handleGrantPendingCredential(req, db);
    } else if (op === "credentials.claimLookup" && req.method === "POST") {
      response = await handleClaimLookup(req, db);
    } else {
      response = json({ message: "Unknown or disallowed op / method", op }, 404);
    }

    return withCors(req, response);
  } catch (e) {
    console.error("[corelia-api] unhandled", e);
    return withCors(req, json({ message: "Unhandled server error" }, 500));
  }
});
