import { supabase } from "@/lib/supabase";
import { makeTTLCache } from "@/lib/utils";
import { getPublicProfileByHandle } from "@/lib/profile";
import type {
  CareerTrack,
  CareerTrackDetail,
  CareerTrackIncludedCourse,
} from "@/types/career";
import type { Course } from "@/types/courses";
import type { PublicProfile } from "@/types/database";

const CATALOG_CACHE_TTL = 3 * 60 * 1000;
const tracksListCache = makeTTLCache<CareerTrackDetail[]>(CATALOG_CACHE_TTL);
const trackBySlugCache = makeTTLCache<CareerTrackDetail | null>(CATALOG_CACHE_TTL);

type CareerTrackRow = CareerTrack;
type CareerTrackCourseRow = {
  sort_order: number;
  course_id: string;
};

type PublicProfileHandleRow = Pick<PublicProfile, "id" | "username" | "ocid">;

type CourseRow = {
  id: string;
  slug: string;
  published: boolean;
  data: Record<string, unknown> | null;
};

const COURSE_ROW_SELECT = "id,slug,published,data" as const;

function rowToCourse(row: CourseRow): Course {
  return {
    ...(row.data ?? {}),
    id: row.id,
    slug: row.slug,
    published: row.published,
  } as Course;
}

function pickIncludedCourse(
  course: Course,
): Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "total_duration_seconds"> {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    thumbnail_url: course.thumbnail_url,
    total_duration_seconds: course.total_duration_seconds,
  };
}

async function fetchPublishedCoursesByIds(
  courseIds: string[],
): Promise<Map<string, Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "total_duration_seconds">>> {
  const result = new Map<
    string,
    Pick<Course, "id" | "slug" | "title" | "thumbnail_url" | "total_duration_seconds">
  >();
  const ids = Array.from(new Set(courseIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const { data, error } = await supabase
    .from("courses")
    .select(COURSE_ROW_SELECT)
    .in("id", ids)
    .eq("published", true);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as CourseRow[]) {
    const course = rowToCourse(row);
    result.set(course.id, pickIncludedCourse(course));
  }

  return result;
}

function profileToHandle(p: PublicProfileHandleRow): string | null {
  return (p.username ?? "").trim() || (p.ocid ?? "").trim() || null;
}

async function fetchHandlesByInstructorIds(
  instructorIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(instructorIds.filter((v): v is string => Boolean(v && v.trim()))),
  );
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("public_profiles")
    .select("id,username,ocid")
    .in("id", ids);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as PublicProfileHandleRow[]) {
    const handle = profileToHandle(row);
    if (handle) map.set(row.id, handle);
  }
  return map;
}

async function computeDetail(
  track: CareerTrackRow,
  courseRows: CareerTrackCourseRow[],
): Promise<CareerTrackDetail> {
  const ids = (courseRows ?? []).map((r) => r.course_id);
  const coursesById = await fetchPublishedCoursesByIds(ids);

  const includedCourses: CareerTrackIncludedCourse[] = (courseRows ?? [])
    .map((r) => ({
      sort_order: Number(r.sort_order) || 0,
      course: coursesById.get(r.course_id) ?? null,
    }))
    .filter((r): r is { sort_order: number; course: CareerTrackIncludedCourse["course"] } =>
      Boolean(r.course),
    )
    .map((r) => ({ sort_order: r.sort_order, course: r.course }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const totalDurationSeconds = includedCourses.reduce(
    (sum, item) => sum + (Number(item.course.total_duration_seconds) || 0),
    0,
  );

  return {
    ...track,
    includedCourses,
    courseCount: includedCourses.length,
    totalDurationSeconds,
  };
}

export async function listCareerTracks(): Promise<CareerTrackDetail[]> {
  const cached = tracksListCache.get("all");
  if (cached) return cached;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("career_tracks")
      .select(
        `
          id,
          owner_scope,
          instructor_id,
          published,
          slug,
          title,
          description,
          what_youll_learn,
          prerequisites,
          has_certificate,
          created_at,
          updated_at,
          career_track_courses (
            sort_order,
            course_id
          )
        `,
      )
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<
      CareerTrackRow & { career_track_courses?: CareerTrackCourseRow[] }
    >;

    const handles = await fetchHandlesByInstructorIds(
      rows.map((r) => (r.owner_scope === "instructor" ? r.instructor_id : null)),
    );

    return await Promise.all(
      rows.map(async (r) => {
      const { career_track_courses, ...track } = r;
        const detail = await computeDetail(track, career_track_courses ?? []);
        return {
          ...detail,
          instructorHandle:
            detail.owner_scope === "instructor" && detail.instructor_id
              ? handles.get(detail.instructor_id) ?? null
              : null,
        };
      }),
    );
  })();

  tracksListCache.set("all", promise);
  promise.catch(() => tracksListCache.delete("all"));
  return promise;
}

export async function getCareerTrackBySlug(
  opts:
    | { owner_scope: "corelia"; slug: string }
    | { owner_scope: "instructor"; handle: string; slug: string },
): Promise<CareerTrackDetail | null> {
  const normalizedSlug = opts.slug.trim();
  if (!normalizedSlug) return null;

  const cacheKey =
    opts.owner_scope === "corelia"
      ? `corelia:${normalizedSlug}`
      : `instructor:${opts.handle.trim().toLowerCase()}:${normalizedSlug}`;

  const cached = trackBySlugCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    let instructorId: string | null = null;
    let instructorHandle: string | null = null;
    if (opts.owner_scope === "instructor") {
      const p = await getPublicProfileByHandle(opts.handle);
      if (!p) return null;
      instructorId = p.id;
      instructorHandle = profileToHandle(p) ?? opts.handle;
    }

    const { data, error } = await supabase
      .from("career_tracks")
      .select(
        `
          id,
          owner_scope,
          instructor_id,
          published,
          slug,
          title,
          description,
          what_youll_learn,
          prerequisites,
          has_certificate,
          created_at,
          updated_at,
          career_track_courses (
            sort_order,
            course_id
          )
        `,
      )
      .eq("owner_scope", opts.owner_scope)
      .eq("slug", normalizedSlug)
      .eq("instructor_id", instructorId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as unknown as CareerTrackRow & {
      career_track_courses?: CareerTrackCourseRow[];
    };
    const { career_track_courses, ...track } = row;
    const detail = await computeDetail(track, career_track_courses ?? []);
    return {
      ...detail,
      instructorHandle:
        detail.owner_scope === "instructor" ? instructorHandle : null,
    };
  })();

  trackBySlugCache.set(cacheKey, promise);
  promise.catch(() => trackBySlugCache.delete(cacheKey));
  return promise;
}

async function requireAuthedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!user) throw new Error("Chưa đăng nhập");
  return user.id;
}

export type CareerTrackUpsertInput = Pick<
  CareerTrack,
  | "slug"
  | "title"
  | "description"
  | "what_youll_learn"
  | "prerequisites"
  | "has_certificate"
> & { published?: boolean };

export async function listCareerTracksForInstructor(): Promise<CareerTrackDetail[]> {
  const userId = await requireAuthedUserId();
  const { data, error } = await supabase
    .from("career_tracks")
    .select(
      `
        id,
        owner_scope,
        instructor_id,
        published,
        slug,
        title,
        description,
        what_youll_learn,
        prerequisites,
        has_certificate,
        created_at,
        updated_at,
        career_track_courses (
          sort_order,
          course_id
        )
      `,
    )
    .eq("owner_scope", "instructor")
    .eq("instructor_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<
    CareerTrackRow & { career_track_courses?: CareerTrackCourseRow[] }
  >;

  return await Promise.all(
    rows.map(async (r) => {
      const { career_track_courses, ...track } = r;
      const detail = await computeDetail(track, career_track_courses ?? []);
      return { ...detail, instructorHandle: null };
    }),
  );
}

export async function createInstructorCareerTrack(
  input: CareerTrackUpsertInput,
): Promise<CareerTrackDetail> {
  const userId = await requireAuthedUserId();
  const payload = {
    owner_scope: "instructor" as const,
    instructor_id: userId,
    published: Boolean(input.published),
    slug: input.slug.trim(),
    title: input.title,
    description: input.description,
    what_youll_learn: input.what_youll_learn ?? [],
    prerequisites: input.prerequisites ?? [],
    has_certificate: Boolean(input.has_certificate),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("career_tracks")
    .insert(payload)
    .select(
      `
        id,
        owner_scope,
        instructor_id,
        published,
        slug,
        title,
        description,
        what_youll_learn,
        prerequisites,
        has_certificate,
        created_at,
        updated_at
      `,
    )
    .single();

  if (error) throw new Error(error.message);

  const track = data as unknown as CareerTrackRow;
  return await computeDetail(track, []);
}

export async function updateInstructorCareerTrack(
  trackId: string,
  patch: Partial<CareerTrackUpsertInput>,
): Promise<void> {
  const userId = await requireAuthedUserId();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof patch.slug === "string") updates.slug = patch.slug.trim();
  if (typeof patch.title === "string") updates.title = patch.title;
  if (typeof patch.description === "string") updates.description = patch.description;
  if (Array.isArray(patch.what_youll_learn)) updates.what_youll_learn = patch.what_youll_learn;
  if (Array.isArray(patch.prerequisites)) updates.prerequisites = patch.prerequisites;
  if (typeof patch.has_certificate === "boolean") updates.has_certificate = patch.has_certificate;
  if (typeof patch.published === "boolean") updates.published = patch.published;

  const { error } = await supabase
    .from("career_tracks")
    .update(updates)
    .eq("id", trackId)
    .eq("owner_scope", "instructor")
    .eq("instructor_id", userId);

  if (error) throw new Error(error.message);
}

export async function setInstructorCareerTrackPublished(
  trackId: string,
  published: boolean,
): Promise<void> {
  return updateInstructorCareerTrack(trackId, { published });
}

export async function setInstructorCareerTrackCourses(
  trackId: string,
  orderedCourseIds: string[],
): Promise<void> {
  const userId = await requireAuthedUserId();

  // Ensure caller owns the track (RLS also enforces, but we fail fast with clear error).
  const { data: trackRow, error: trackError } = await supabase
    .from("career_tracks")
    .select("id")
    .eq("id", trackId)
    .eq("owner_scope", "instructor")
    .eq("instructor_id", userId)
    .maybeSingle();
  if (trackError) throw new Error(trackError.message);
  if (!trackRow) throw new Error("Không có quyền sửa lộ trình này");

  const normalized = orderedCourseIds
    .map((v) => v.trim())
    .filter(Boolean);
  const deduped = Array.from(new Set(normalized));

  const { data: existing, error: existingError } = await supabase
    .from("career_track_courses")
    .select("course_id")
    .eq("track_id", trackId);
  if (existingError) throw new Error(existingError.message);

  const existingIds = new Set((existing ?? []).map((r) => String((r as any).course_id)));
  const desiredIds = new Set(deduped);
  const toDelete = Array.from(existingIds).filter((id) => !desiredIds.has(id));

  if (toDelete.length) {
    const { error } = await supabase
      .from("career_track_courses")
      .delete()
      .eq("track_id", trackId)
      .in("course_id", toDelete);
    if (error) throw new Error(error.message);
  }

  const upserts = deduped.map((courseId, idx) => ({
    track_id: trackId,
    course_id: courseId,
    sort_order: idx + 1,
  }));

  if (upserts.length) {
    const { error } = await supabase
      .from("career_track_courses")
      .upsert(upserts, { onConflict: "track_id,course_id" });
    if (error) throw new Error(error.message);
  }
}

