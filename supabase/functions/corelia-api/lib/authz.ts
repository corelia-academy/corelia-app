import type { SupabaseClient } from "./supabase.ts";

export function isAuthFailure(message: string): boolean {
  return /authorization|session|jwt|token/i.test(message);
}

export async function getUserRole(db: SupabaseClient, uid: string): Promise<string> {
  const { data, error } = await db.from("profiles").select("role").eq("id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.role ?? "");
}

export async function getProfileDoc(
  db: SupabaseClient,
  uid: string,
): Promise<{ role?: string; instructor_origin?: string | null }> {
  const { data, error } = await db.from("profiles").select("role, instructor_origin").eq("id", uid).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {}) as { role?: string; instructor_origin?: string | null };
}

function isCoInstructor(courseData: Record<string, unknown>, userId: string): boolean {
  const perms = courseData.co_instructor_permissions;
  if (!perms || typeof perms !== "object" || Array.isArray(perms)) return false;
  return Object.prototype.hasOwnProperty.call(perms as object, userId);
}

export async function canManageHackathon(db: SupabaseClient, uid: string, hackathonId: string): Promise<boolean> {
  const role = await getUserRole(db, uid);
  if (role === "admin" || role === "support_staff") return true;
  const { data, error } = await db.from("hackathons").select("document").eq("id", hackathonId).maybeSingle();
  if (error) throw new Error(error.message);
  const createdBy = data?.document != null && typeof data.document === "object"
    ? String((data.document as Record<string, unknown>).created_by ?? "")
    : "";
  return createdBy === uid;
}

export async function canManageCourse(db: SupabaseClient, uid: string, courseId: string): Promise<boolean> {
  const [role, courseRes] = await Promise.all([
    getUserRole(db, uid),
    db.from("courses").select("instructor_id, data").eq("id", courseId).maybeSingle(),
  ]);
  if (courseRes.error) throw new Error(courseRes.error.message);
  if (!courseRes.data) return false;
  if (role === "admin" || role === "support_staff") return true;
  if (role !== "instructor") return false;
  if (String(courseRes.data.instructor_id ?? "") === uid) return true;
  const data = (courseRes.data.data ?? {}) as Record<string, unknown>;
  return isCoInstructor(data, uid);
}
