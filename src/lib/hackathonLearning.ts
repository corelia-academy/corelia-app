import { getCoursesByIds } from "@/lib/courses";
import { supabase } from "@/lib/supabase";

export type ResolvedLearningCourse = {
  id: string;
  slug: string;
  title: string;
};

export type ResolvedLearningTrack = {
  id: string;
  slug: string;
  title: string;
  owner_scope: "corelia" | "instructor";
  instructorHandle: string | null;
};

export async function resolveContestLearningLinks(
  courseIds: string[],
  trackIds: string[],
): Promise<{
  coursesById: Map<string, ResolvedLearningCourse>;
  tracksById: Map<string, ResolvedLearningTrack>;
}> {
  const [courseMap, trackResult] = await Promise.all([
    getCoursesByIds(courseIds),
    trackIds.length
      ? supabase
          .from("career_tracks")
          .select("id,slug,title,owner_scope,instructor_id,published")
          .in("id", trackIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const coursesById = new Map<string, ResolvedLearningCourse>();
  for (const [id, course] of courseMap) {
    const slug = course.slug?.trim();
    const title = course.title?.trim();
    if (slug && title) coursesById.set(id, { id, slug, title });
  }

  if (trackResult.error) throw new Error(trackResult.error.message);
  const trackRows = trackResult.data ?? [];
  const instructorIds = Array.from(
    new Set(
      trackRows
        .filter((row) => row.owner_scope === "instructor" && row.instructor_id)
        .map((row) => row.instructor_id as string),
    ),
  );
  const { data: profiles, error: profileError } = instructorIds.length
    ? await supabase
        .from("public_profiles")
        .select("id,username,ocid")
        .in("id", instructorIds)
    : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);

  const handleByInstructor = new Map(
    (profiles ?? []).flatMap((profile) => {
      const handle = profile.username?.trim() || profile.ocid?.trim();
      return handle ? [[profile.id, handle] as const] : [];
    }),
  );
  const tracksById = new Map<string, ResolvedLearningTrack>();
  for (const row of trackRows) {
    if (!row.published) continue;
    const ownerScope = row.owner_scope === "instructor" ? "instructor" : "corelia";
    tracksById.set(row.id, {
      id: row.id,
      slug: row.slug,
      title: row.title,
      owner_scope: ownerScope,
      instructorHandle:
        ownerScope === "instructor" && row.instructor_id
          ? handleByInstructor.get(row.instructor_id) ?? null
          : null,
    });
  }

  return { coursesById, tracksById };
}
