import { isAuthFailure } from "../lib/authz.ts";
import { json } from "../lib/http.ts";
import { verifyBearerUser, type SupabaseClient } from "../lib/supabase.ts";
import { evaluateCourseCredentialEligibility } from "./check_course.ts";

export type CourseOcaTemplateSummary = {
  id: string;
  courseId: string;
  name: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  achievementType: string;
};

/**
 * Active OCA (collection_symbol IS NULL) course templates for a batch of
 * course ids — runs server-side (service-role) because credential_templates
 * RLS only lets a student read a row once they already have an issuance for
 * it, which is exactly the "not claimed yet" case this endpoint serves.
 */
export async function handleListActiveOcaTemplates(
  req: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    const user = await verifyBearerUser(req, db);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const courseIds = Array.isArray(body.courseIds)
      ? body.courseIds.map((v) => String(v)).filter((v) => v.trim().length > 0)
      : [];
    if (courseIds.length === 0) return json({ ok: true, templates: [] });

    const { data, error } = await db
      .from("credential_templates")
      .select("id, course_id, name, description, image_url, thumbnail_url, achievement_type, collection_symbol, trigger_rule")
      .eq("scope_type", "course")
      .eq("is_active", true)
      .is("collection_symbol", null)
      .in("course_id", courseIds);
    if (error) throw new Error(error.message);

    const eligibleTemplates = await Promise.all(
      (data ?? [])
        .filter((row) => row.course_id != null)
        .map(async (row) => {
          const eligibility = await evaluateCourseCredentialEligibility(
            db,
            String(row.course_id),
            user.id,
            row.trigger_rule,
          );
          if (!eligibility.eligible) return null;
          return {
            id: String(row.id),
            courseId: String(row.course_id),
            name: String(row.name ?? ""),
            description: String(row.description ?? ""),
            imageUrl: String(row.image_url ?? ""),
            thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
            achievementType: String(row.achievement_type ?? "CertificateOfCompletion"),
          } satisfies CourseOcaTemplateSummary;
        }),
    );
    const templates = eligibleTemplates.filter(
      (template): template is CourseOcaTemplateSummary => template !== null,
    );

    return json({ ok: true, templates });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (isAuthFailure(message)) return json({ message: "Chưa đăng nhập", ok: false }, 401);
    console.error("[corelia-api] credentials.listActiveOcaTemplates", e);
    return json({ message: "Không thể tải template OCA.", ok: false }, 500);
  }
}
