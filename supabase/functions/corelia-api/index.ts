/**
 * Corelia API — Supabase Edge Function (Deno).
 * Invoke: GET/POST {SUPABASE_URL}/functions/v1/corelia-api?op=<operation>
 */
import { handleBackfillEligibleCertificates, handleIssueCertificate } from "./certificates/handlers.ts";
import { handleRevokeCertificate } from "./certificates/revoke.ts";
import { handleVerifyCertificate } from "./certificates/verify.ts";
import { handleHackathonListEligible } from "./credentials/hackathon_eligible.ts";
import { handleCareerTrackBlastEmail } from "./career-tracks/blast_email.ts";
import { handleCheckActivityMilestones } from "./credentials/check_activity.ts";
import { handleCheckCourseCompletion } from "./credentials/check_course.ts";
import { handleClaimLookup } from "./credentials/claim_lookup.ts";
import { handleGrantCredentials } from "./credentials/grant.ts";
import { handleListActiveOcaTemplates } from "./credentials/list_active_oca_templates.ts";
import { handleListActiveCourseCredentialTemplates } from "./credentials/list_active_course_credential_templates.ts";
import { handleGrantPendingCredential } from "./credentials/grant_pending.ts";
import { handleRetryPendingCredentials } from "./credentials/retry_pending.ts";
import { handleRevokeCredential } from "./credentials/revoke.ts";
import { handleCourseBlastEmail } from "./courses/blast_email.ts";
import { handleCoInstructorInviteEmail } from "./courses/co_instructor_invite_email.ts";
import { handleSendLearningReminders } from "./courses/learning_reminders.ts";
import { handleSyncCourseCompletion } from "./courses/completion.ts";
import { handleHackathonBlastEmail } from "./hackathons/blast_email.ts";
import { handleHackathonNotifyRegistrationReview } from "./hackathons/handlers.ts";
import { corsHeadersForRequest, json, withCors } from "./lib/http.ts";
import { handleNotificationsUnsubscribe } from "./notifications/unsubscribe.ts";
import {
  handleProjectMediaDelete,
  handleProjectMediaUpload,
  handleProjectSave,
} from "./projects/handlers.ts";
import {
  handleJobsAdmin,
  handleJobsRefreshAnalytics,
  handleJobsReview,
  handleJobsRun,
  handleJobsRunScheduled,
} from "./jobs/handlers.ts";
import { createServiceClient, type SupabaseClient } from "./lib/supabase.ts";

const PROTECTED_OPS = new Set<string>([
  "certificates.issue",
  "certificates.backfillEligible",
  "certificates.revoke",
  // certificates.verify is PUBLIC — intentionally omitted from PROTECTED_OPS
  "hackathons.notifyRegistrationReview",
  "hackathons.blastEmail",
  "courses.syncCompletion",
  "courses.blastEmail",
  "courses.coInstructorInvite.sendEmail",
  "courses.sendLearningReminders",
  "careerTracks.blastEmail",
  // notifications.unsubscribe is PUBLIC — intentionally omitted from PROTECTED_OPS
  "credentials.checkCourseCompletion",
  "credentials.checkActivityMilestones",
  "credentials.grant",
  "credentials.retryPending",
  "credentials.revoke",
  "credentials.hackathon.listEligible",
  "credentials.listActiveOcaTemplates",
  "credentials.listActiveCourseCredentialTemplates",
  "credentials.grantPending",
  "projects.save",
  "projects.media.upload",
  "projects.media.delete",
  "jobs.run",
  "jobs.runScheduled",
  "jobs.refreshAnalytics",
  "jobs.review",
  "jobs.admin",
  // credentials.claimLookup is PUBLIC — intentionally omitted from PROTECTED_OPS
]);

function hasBearerAuthHeader(req: Request): boolean {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  return /^Bearer\s+\S+$/i.test(header ?? "");
}

function hasLearningReminderCronSecret(req: Request): boolean {
  const expected = Deno.env.get("LEARNING_REMINDER_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-cron-secret")?.trim() ?? "";
  return Boolean(expected && provided && expected === provided);
}

function hasJobsCronSecret(req: Request): boolean {
  const expected = Deno.env.get("CORELIA_JOBS_CRON_SECRET")?.trim() ?? "";
  const provided = req.headers.get("x-corelia-jobs-cron-secret")?.trim() ?? "";
  return Boolean(expected && provided && expected === provided);
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
    const isLearningReminderCron = op === "courses.sendLearningReminders" && hasLearningReminderCronSecret(req);
    const isJobsCron = op === "jobs.runScheduled" && hasJobsCronSecret(req);
    if (PROTECTED_OPS.has(op) && !hasBearerAuthHeader(req) && !isLearningReminderCron && !isJobsCron) {
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
    } else if (op === "certificates.issue" && req.method === "POST") {
      response = await handleIssueCertificate(req, db);
    } else if (op === "certificates.backfillEligible" && req.method === "POST") {
      response = await handleBackfillEligibleCertificates(req, db);
    } else if (op === "certificates.verify" && req.method === "POST") {
      response = await handleVerifyCertificate(req, db);
    } else if (op === "certificates.revoke" && req.method === "POST") {
      response = await handleRevokeCertificate(req, db);
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
    } else if (op === "courses.sendLearningReminders" && req.method === "POST") {
      response = await handleSendLearningReminders(req, db, { allowCron: isLearningReminderCron });
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
    } else if (op === "credentials.revoke" && req.method === "POST") {
      response = await handleRevokeCredential(req, db);
    } else if (op === "credentials.hackathon.listEligible" && req.method === "POST") {
      response = await handleHackathonListEligible(req, db);
    } else if (op === "credentials.listActiveOcaTemplates" && req.method === "POST") {
      response = await handleListActiveOcaTemplates(req, db);
    } else if (op === "credentials.listActiveCourseCredentialTemplates" && req.method === "POST") {
      response = await handleListActiveCourseCredentialTemplates(req, db);
    } else if (op === "credentials.grantPending" && req.method === "POST") {
      response = await handleGrantPendingCredential(req, db);
    } else if (op === "credentials.claimLookup" && req.method === "POST") {
      response = await handleClaimLookup(req, db);
    } else if (op === "projects.save" && req.method === "POST") {
      response = await handleProjectSave(req, db);
    } else if (op === "projects.media.upload" && req.method === "POST") {
      response = await handleProjectMediaUpload(req, db);
    } else if (op === "projects.media.delete" && req.method === "POST") {
      response = await handleProjectMediaDelete(req, db);
    } else if (op === "jobs.run" && req.method === "POST") {
      response = await handleJobsRun(req, db);
    } else if (op === "jobs.runScheduled" && req.method === "POST") {
      response = await handleJobsRunScheduled(req, db);
    } else if (op === "jobs.refreshAnalytics" && req.method === "POST") {
      response = await handleJobsRefreshAnalytics(req, db);
    } else if (op === "jobs.review" && req.method === "POST") {
      response = await handleJobsReview(req, db);
    } else if (op === "jobs.admin" && req.method === "POST") {
      response = await handleJobsAdmin(req, db);
    } else {
      response = json({ message: "Not found" }, 404);
    }
    return withCors(req, response);
  } catch (e) {
    console.error("[corelia-api] error", e);
    return withCors(req, json({ message: "Internal server error" }, 500));
  }
});
