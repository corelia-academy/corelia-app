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

export async function invokeCheckCourseCredential(courseId: string, userId?: string): Promise<
  Record<string, unknown>
> {
  return await postJson("credentials.checkCourseCompletion", {
    courseId,
    ...(userId ? { userId } : {}),
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
