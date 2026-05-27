import { supabase } from "@/lib/supabase";
import { makeTTLCache } from "@/lib/utils";
import { normalizeContentLocale, pickContentLocale } from "@/lib/entityLocales";
import type {
  CareerTrack,
  CareerTrackDetail,
  CareerTrackIncludedCourse,
} from "@/types/career";
import type { Course } from "@/types/courses";
import type { Locale, PublicProfile } from "@/types/database";

const CATALOG_CACHE_TTL = 3 * 60 * 1000;
const tracksListCache = makeTTLCache<CareerTrackDetail[]>(CATALOG_CACHE_TTL);
const trackBySlugCache = makeTTLCache<CareerTrackDetail | null>(CATALOG_CACHE_TTL);

const LOCALE_CACHE_TTL = 5 * 60 * 1000;
const careerTrackLocaleCache = makeTTLCache<Partial<CareerTrack> | null>(LOCALE_CACHE_TTL);

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

type IncludedCoursePick = Pick<
  Course,
  | "id"
  | "slug"
  | "title"
  | "thumbnail_url"
  | "total_duration_seconds"
  | "short_description"
>;

function pickIncludedCourse(course: Course): IncludedCoursePick {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    thumbnail_url: course.thumbnail_url,
    total_duration_seconds: course.total_duration_seconds,
    short_description: course.short_description,
  };
}

async function fetchPublishedCoursesByIds(
  courseIds: string[],
): Promise<Map<string, IncludedCoursePick>> {
  const result = new Map<string, IncludedCoursePick>();
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

function applyCareerTrackLocaleContent(
  track: CareerTrackDetail,
  localized: Partial<Pick<CareerTrack, "title" | "description" | "what_youll_learn" | "prerequisites">> | null,
): CareerTrackDetail {
  if (!localized) return track;
  return {
    ...track,
    title: localized.title ?? track.title,
    description: localized.description ?? track.description,
    what_youll_learn: localized.what_youll_learn ?? track.what_youll_learn,
    prerequisites: localized.prerequisites ?? track.prerequisites,
  };
}

export async function getCareerTrackLocaleContent(
  trackId: string,
  locale: Locale,
): Promise<Partial<CareerTrack> | null> {
  const normalized = normalizeContentLocale(locale);
  const key = `${trackId}:${normalized}`;
  const existing = careerTrackLocaleCache.get(key);
  if (existing) return existing;
  const promise = (async () => {
    const { data, error } = await supabase
      .from("career_track_locales")
      .select("data")
      .eq("career_track_id", trackId)
      .eq("locale", normalized)
      .maybeSingle();
    if (error || !data?.data) return null;
    return data.data as Partial<CareerTrack>;
  })();
  careerTrackLocaleCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    careerTrackLocaleCache.delete(key);
    throw e;
  }
}

export async function getBatchCareerTrackLocaleContent(
  trackIds: string[],
  locale: Locale,
): Promise<Map<string, Partial<CareerTrack>>> {
  const normalized = normalizeContentLocale(locale);
  const result = new Map<string, Partial<CareerTrack>>();
  const ids = Array.from(new Set(trackIds.map((v) => v.trim()).filter(Boolean)));
  if (ids.length === 0) return result;

  const uncachedIds: string[] = [];
  for (const id of ids) {
    const cached = careerTrackLocaleCache.get(`${id}:${normalized}`);
    if (cached) {
      const content = await cached;
      if (content) result.set(id, content);
    } else {
      uncachedIds.push(id);
    }
  }
  if (uncachedIds.length === 0) return result;

  const { data, error } = await supabase
    .from("career_track_locales")
    .select("career_track_id,data")
    .in("career_track_id", uncachedIds)
    .eq("locale", normalized);

  if (!error && data) {
    for (const row of data as Array<{ career_track_id: string; data: unknown }>) {
      if (!row.data) continue;
      const content = row.data as Partial<CareerTrack>;
      careerTrackLocaleCache.set(`${row.career_track_id}:${normalized}`, Promise.resolve(content));
      result.set(row.career_track_id, content);
    }
  }

  return result;
}

export async function setCareerTrackLocaleContent(
  trackId: string,
  locale: Locale,
  data: Partial<Pick<CareerTrack, "title" | "description" | "what_youll_learn" | "prerequisites">>,
): Promise<void> {
  const normalized = normalizeContentLocale(locale);
  const payload = {
    ...data,
    updated_at: new Date().toISOString(),
  } as Record<string, unknown>;
  const { error } = await supabase.from("career_track_locales").upsert(
    { career_track_id: trackId, locale: normalized, data: payload },
    { onConflict: "career_track_id,locale" },
  );
  if (error) throw new Error(error.message);
  careerTrackLocaleCache.delete(`${trackId}:${normalized}`);
}

export async function listCareerTracks(uiLocale?: string | null): Promise<CareerTrackDetail[]> {
  const normalizedUiLocale = normalizeContentLocale(uiLocale);
  const cacheKey = `all:${normalizedUiLocale}`;

  const cached = tracksListCache.get(cacheKey);
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
          i18n,
          slug,
          title,
          description,
          what_youll_learn,
          prerequisites,
          has_certificate,
          thumbnail_url,
          thumbnail_path,
          short_description,
          sponsors,
          partner_brand,
          partners,
          created_at,
          updated_at,
          career_track_courses (
            sort_order,
            course_id
          )
        `,
      )
      .eq("published", true)
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

  tracksListCache.set(cacheKey, promise);
  promise.catch(() => tracksListCache.delete(cacheKey));
  const list = await promise;

  // Apply localized content (preferred UI locale) if available.
  const idsByLocale = new Map<Locale, string[]>();
  for (const track of list) {
    const desired = pickContentLocale(track.i18n ?? null, normalizedUiLocale);
    const ids = idsByLocale.get(desired) ?? [];
    ids.push(track.id);
    idsByLocale.set(desired, ids);
  }
  const localeMaps = new Map<Locale, Map<string, Partial<CareerTrack>>>();
  await Promise.all(
    Array.from(idsByLocale.entries()).map(async ([locale, ids]) => {
      localeMaps.set(locale, await getBatchCareerTrackLocaleContent(ids, locale));
    }),
  );
  return list.map((track) => {
    const desired = pickContentLocale(track.i18n ?? null, normalizedUiLocale);
    const localized = localeMaps.get(desired)?.get(track.id) ?? null;
    return applyCareerTrackLocaleContent(track, localized);
  });
}

export async function getCareerTrackBySlug(
  slug: string,
  uiLocale?: string | null,
): Promise<CareerTrackDetail | null> {
  const normalizedUiLocale = normalizeContentLocale(uiLocale);
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const cacheKey = `slug:${normalizedSlug}:${normalizedUiLocale}`;
  const cached = trackBySlugCache.get(cacheKey);
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
          i18n,
          slug,
          title,
          description,
          what_youll_learn,
          prerequisites,
          has_certificate,
          thumbnail_url,
          thumbnail_path,
          short_description,
          sponsors,
          partner_brand,
          partners,
          created_at,
          updated_at,
          career_track_courses (
            sort_order,
            course_id
          )
        `,
      )
      .eq("slug", normalizedSlug)
      .eq("published", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as unknown as CareerTrackRow & {
      career_track_courses?: CareerTrackCourseRow[];
    };
    const { career_track_courses, ...track } = row;
    const detail = await computeDetail(track, career_track_courses ?? []);

    let instructorHandle: string | null = null;
    if (detail.owner_scope === "instructor" && detail.instructor_id) {
      const handles = await fetchHandlesByInstructorIds([detail.instructor_id]).catch(() => new Map<string, string>());
      instructorHandle = handles.get(detail.instructor_id) ?? null;
    }

    const resolved: CareerTrackDetail = { ...detail, instructorHandle };
    const desired = pickContentLocale(resolved.i18n ?? null, normalizedUiLocale);
    const localized = await getCareerTrackLocaleContent(resolved.id, desired);
    return applyCareerTrackLocaleContent(resolved, localized);
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
  | "i18n"
> & {
  published?: boolean;
  short_description?: string | null;
  thumbnail_url?: string | null;
  thumbnail_path?: string | null;
  sponsors?: CareerTrack["sponsors"];
  partner_brand?: CareerTrack["partner_brand"];
  partners?: CareerTrack["partners"];
};

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
        i18n,
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
    short_description: input.short_description ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    thumbnail_path: input.thumbnail_path ?? null,
    sponsors: input.sponsors ?? [],
    partner_brand: input.partner_brand ?? null,
    partners: input.partners ?? [],
    i18n: input.i18n ?? null,
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
        i18n,
        slug,
        title,
        description,
        what_youll_learn,
        prerequisites,
        has_certificate,
        thumbnail_url,
        thumbnail_path,
        short_description,
        sponsors,
        partner_brand,
        partners,
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
  if (patch.short_description !== undefined) updates.short_description = patch.short_description;
  if (patch.thumbnail_url !== undefined) updates.thumbnail_url = patch.thumbnail_url;
  if (patch.thumbnail_path !== undefined) updates.thumbnail_path = patch.thumbnail_path;
  if (patch.sponsors !== undefined) updates.sponsors = patch.sponsors ?? [];
  if (patch.partner_brand !== undefined) updates.partner_brand = patch.partner_brand;
  if (patch.partners !== undefined) updates.partners = patch.partners ?? [];
  if (patch.i18n !== undefined) updates.i18n = patch.i18n;

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

  const existingIds = new Set(
    (existing ?? [])
      .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>).course_id : null))
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0),
  );
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

