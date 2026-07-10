import { coreliaEdgeUrl, supabaseFunctionHeaders } from "@/lib/coreliaEdgeApi";
import { supabase } from "@/lib/supabase";

async function postJson<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const url = coreliaEdgeUrl(op);
  if (!url) throw new Error("Thiếu cấu hình Corelia Edge URL.");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Chưa đăng nhập");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const parsed = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(typeof parsed.message === "string" ? parsed.message : `HTTP ${res.status}`);
  }
  return parsed;
}

/** Like postJson, but for ops NOT in PROTECTED_OPS (verify_jwt is off for this
 *  function, see supabase/config.toml) — no session/bearer token required, only
 *  the anon apikey header. Used by the public /claim page. */
async function postPublicJson<T>(op: string, body: Record<string, unknown>): Promise<T> {
  const url = coreliaEdgeUrl(op);
  if (!url) throw new Error("Thiếu cấu hình Corelia Edge URL.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseFunctionHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const parsed = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) {
    throw new Error(typeof parsed.message === "string" ? parsed.message : `HTTP ${res.status}`);
  }
  return parsed;
}

export async function invokeCheckCourseCredential(
  courseId: string,
  userId?: string,
  opts?: { autoIssue?: boolean },
): Promise<Record<string, unknown>> {
  return await postJson("credentials.checkCourseCompletion", {
    courseId,
    ...(userId ? { userId } : {}),
    ...(opts?.autoIssue ? { autoIssue: true } : {}),
  });
}

export async function invokeCheckActivityMilestones(
  eventType: string,
  payload?: Record<string, unknown>,
  userId?: string,
): Promise<Record<string, unknown>> {
  return await postJson("credentials.checkActivityMilestones", {
    eventType,
    ...(payload ? { payload } : {}),
    ...(userId ? { userId } : {}),
  });
}

export async function invokeGrantCredentials(params: {
  templateId: string;
  userIds: string[];
  grantedReason?: string | null;
}): Promise<{ ok?: boolean; issuanceIds?: string[]; errors?: string[]; message?: string }> {
  return await postJson("credentials.grant", {
    templateId: params.templateId,
    userIds: params.userIds,
    ...(params.grantedReason ? { grantedReason: params.grantedReason } : {}),
  });
}

export type EligibleUser = {
  userId: string;
  displayName: string;
  teamName: string | null;
  hasOcid: boolean;
  issuanceStatus: "none" | "pending" | "minted" | "failed";
  issuanceId: string | null;
};

export async function invokeHackathonListEligible(params: {
  hackathonId: string;
  templateId: string;
}): Promise<{
  ok: boolean;
  users?: EligibleUser[];
  summary?: { total: number; minted: number; pending: number; failed: number; none: number };
  message?: string;
}> {
  return await postJson("credentials.hackathon.listEligible", {
    hackathonId: params.hackathonId,
    templateId: params.templateId,
  });
}

export async function invokeGrantPendingCredential(params: {
  templateId: string;
  email: string;
  grantedReason?: string | null;
}): Promise<{ ok?: boolean; mode?: "direct" | "pending"; issuanceIds?: string[]; errors?: string[]; emailSent?: boolean; message?: string }> {
  return await postJson("credentials.grantPending", {
    templateId: params.templateId,
    email: params.email,
    ...(params.grantedReason ? { grantedReason: params.grantedReason } : {}),
  });
}

export type PendingClaimItem = { name: string; imageUrl: string | null; isOCA: boolean };

export async function invokeClaimLookup(email: string): Promise<{ ok: boolean; items?: PendingClaimItem[]; message?: string }> {
  return await postPublicJson("credentials.claimLookup", { email });
}
