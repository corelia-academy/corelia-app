import { invokeCoreliaApi, callCoreliaApi } from "@/lib/coreliaEdgeApi";
import i18n from "@/i18n";
import { supabase } from "@/lib/supabase";
import { removeUndefinedFields, makeTTLCache } from "@/lib/utils";
import { deleteStorageObjectByPath } from "@/lib/storage";
import { getProfileForUser } from "@/lib/profile";
import { normalizeContentLocale, pickContentLocale } from "@/lib/entityLocales";
import {
  canManageContests,
  canReviewContestApplications,
  canScoreContest,
} from "@/lib/permissions";
import type {
  Contest,
  ContestAccessInvite,
  ContestAccessInviteInsert,
  ContestFaqEntry,
  ContestI18nContent,
  ContestInsert,
  ContestLeaderboardEntry,
  ContestMetricsSnapshot,
  ContestOrganizationalPartner,
  ContestPrizeEntry,
  ContestRegistration,
  ContestRegistrationInsert,
  ContestRegistrationReviewInput,
  ContestRegistrationStatus,
  ContestRubricWeights,
  ContestScore,
  ContestScoreInput,
  ContestSubmission,
  ContestSubmissionInsert,
  ContestTrack,
  ContestRound,
  ContestTimelineMilestone,
  ContestUpdate,
  ContestWinner,
  ContestWinnerInput,
} from "@/types/hackathons";
import type { User } from "@supabase/supabase-js";
import type { Locale, Profile } from "@/types/database";

const PUBLIC_CONTEST_STATUSES: Contest["status"][] = ["published", "running", "ended"];

/** PostgREST row columns needed to build `Contest` via `contestFromRow` (avoids `select("*")`). */
const CONTEST_ROW_SELECT = "id,status,created_at,updated_at,document" as const;

const contestListCache = makeTTLCache<Contest[]>(2 * 60 * 1000);

/** Same-bucket concurrent `listContests` calls share one in-flight fetch (race-safe vs TTL cache). */
const listContestsInFlight = new Map<string, Promise<Contest[]>>();

/** `ContestPublicLayout` + detail payload can overlap; collapse duplicate `getContest` rows. */
const getContestByIdInFlight = new Map<string, Promise<Contest | null>>();
const getContestBySlugInFlight = new Map<string, Promise<Contest | null>>();

const LOCALE_CACHE_TTL = 5 * 60 * 1000;
const hackathonLocaleCache = makeTTLCache<ContestI18nContent | null>(LOCALE_CACHE_TTL);
/** Dedup concurrent fetches for the same key — separate from TTL so TTL starts on resolution. */
const hackathonLocaleInFlight = new Map<string, Promise<ContestI18nContent | null>>();

function sanitizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase();
  if (!lowered) return null;
  const cleaned = lowered
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

function getHackathonIdFromRow(row: Record<string, unknown>): string | null {
  const v = row.hackathon_id ?? row.contest_id;
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * When contest detail already resolved `contest` + viewer `profile`, pass this to skip duplicate
 * `getContest` / `getProfileForUser` inside permission helpers.
 */
export type PrefetchedContestActorContext = {
  contest: Contest;
  viewer: User;
  profile: Profile | null;
};

function applyContestLocaleContent(contest: Contest, localized: ContestI18nContent | null): Contest {
  if (!localized) return contest;
  return {
    ...contest,
    title: localized.title ?? contest.title,
    tagline: localized.tagline ?? contest.tagline,
    description: localized.description ?? contest.description,
    rules: localized.rules ?? contest.rules,
    prize_pool_summary: localized.prize_pool_summary ?? contest.prize_pool_summary,
    faqs: localized.faqs ?? contest.faqs,
    timeline_milestones: localized.timeline_milestones ?? contest.timeline_milestones,
    organizational_partners:
      localized.organizational_partners ?? contest.organizational_partners,
    tracks: localized.tracks ? (localized.tracks as Contest["tracks"]) : contest.tracks,
    rounds: localized.rounds ? (localized.rounds as Contest["rounds"]) : contest.rounds,
  };
}

export async function getHackathonLocaleContent(
  contestId: string,
  locale: Locale,
): Promise<ContestI18nContent | null> {
  const normalized = normalizeContentLocale(locale);
  const key = `${contestId}:${normalized}`;

  const cached = hackathonLocaleCache.get(key);
  if (cached) return cached;

  const inflight = hackathonLocaleInFlight.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const { data, error } = await supabase
        .from("hackathon_locales")
        .select("data")
        .eq("hackathon_id", contestId)
        .eq("locale", normalized)
        .maybeSingle();
      const result: ContestI18nContent | null =
        error || !data?.data
          ? null
          : { ...(data.data as ContestI18nContent), updated_at: (data.data as ContestI18nContent).updated_at };
      hackathonLocaleCache.set(key, Promise.resolve(result));
      return result;
    } finally {
      hackathonLocaleInFlight.delete(key);
    }
  })();

  hackathonLocaleInFlight.set(key, promise);
  return promise;
}

export async function getBatchHackathonLocaleContent(
  contestIds: string[],
  locale: Locale,
): Promise<Map<string, ContestI18nContent>> {
  const normalized = normalizeContentLocale(locale);
  const result = new Map<string, ContestI18nContent>();
  const ids = Array.from(new Set(contestIds.map((v) => v.trim()).filter(Boolean)));
  if (ids.length === 0) return result;

  const uncachedIds: string[] = [];
  for (const id of ids) {
    const cached = hackathonLocaleCache.get(`${id}:${normalized}`);
    if (cached) {
      const content = await cached;
      if (content) result.set(id, content);
    } else {
      uncachedIds.push(id);
    }
  }
  if (uncachedIds.length === 0) return result;

  const { data, error } = await supabase
    .from("hackathon_locales")
    .select("hackathon_id,data")
    .in("hackathon_id", uncachedIds)
    .eq("locale", normalized);

  if (!error && data) {
    for (const row of data as Array<{ hackathon_id: string; data: unknown }>) {
      if (!row.data) continue;
      const content = row.data as ContestI18nContent;
      hackathonLocaleCache.set(`${row.hackathon_id}:${normalized}`, Promise.resolve(content));
      result.set(row.hackathon_id, content);
    }
  }

  return result;
}

export async function setHackathonLocaleContent(
  contestId: string,
  locale: Locale,
  data: Partial<ContestI18nContent>,
): Promise<void> {
  const normalized = normalizeContentLocale(locale);
  const payload = removeUndefinedFields({
    ...data,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>;
  const { error } = await supabase.from("hackathon_locales").upsert(
    { hackathon_id: contestId, locale: normalized, data: payload },
    { onConflict: "hackathon_id,locale" },
  );
  if (error) throw new Error(error.message);
  hackathonLocaleCache.delete(`${contestId}:${normalized}`);
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeEmailList(values: string[] | undefined): string[] {
  if (!values) return [];
  return Array.from(
    new Set(values.map((value) => sanitizeEmail(value)).filter(Boolean)),
  );
}

function sanitizeStringList(values: string[] | undefined): string[] {
  if (!values) return [];
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function sanitizePrizeEntries(values: ContestPrizeEntry[] | undefined): ContestPrizeEntry[] {
  if (!values?.length) return [];
  return values
    .map((p) => ({
      rank_label: p.rank_label.trim(),
      title: p.title.trim(),
      value_display: p.value_display?.trim() || null,
      description: p.description?.trim() || null,
    }))
    .filter((p) => p.rank_label.length > 0 && p.title.length > 0);
}

function sanitizeFaqEntries(values: ContestFaqEntry[] | undefined): ContestFaqEntry[] {
  if (!values?.length) return [];
  return values
    .map((f) => ({
      question: f.question.trim(),
      answer: f.answer.trim(),
    }))
    .filter((f) => f.question.length > 0 && f.answer.length > 0);
}

function sanitizeTimelineMilestones(
  values: ContestTimelineMilestone[] | undefined,
): ContestTimelineMilestone[] {
  if (!values?.length) return [];
  const cleaned = values
    .map((m) => ({
      title: m.title.trim(),
      at: m.at.trim(),
    }))
    .filter((m) => m.title.length > 0 && m.at.length > 0);
  cleaned.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return cleaned;
}

function sanitizeOrganizationalPartners(
  values: ContestOrganizationalPartner[] | undefined,
): ContestOrganizationalPartner[] {
  if (!values?.length) return [];
  return values
    .map((p) => {
      const title = p.title.trim();
      const id = p.id?.trim();
      return {
        ...(id ? { id } : {}),
        logo_url: p.logo_url?.trim() || null,
        logo_path: p.logo_path?.trim() || null,
        title,
        description: p.description?.trim() || null,
      };
    })
    .filter((p) => p.title.length > 0);
}

function contestRegistrationId(contestId: string, userId: string): string {
  return `${contestId}_${userId}`;
}

function contestInviteId(contestId: string, email: string): string {
  return `${contestId}_${sanitizeEmail(email)}`;
}

export function contestSubmissionId(contestId: string, userId: string): string {
  return `${contestId}_${userId}`;
}

function contestScoreId(submissionId: string, judgeUid: string): string {
  return `${submissionId}_${judgeUid}`;
}

function generateDisplayId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function emptyMetricsSnapshot(): ContestMetricsSnapshot {
  return {
    registrations_total: 0,
    pending_registrations: 0,
    approved_registrations: 0,
    rejected_registrations: 0,
    submissions_total: 0,
    scored_submissions: 0,
    published_winners: 0,
    updated_at: null,
  };
}

function defaultRubricWeights(): ContestRubricWeights {
  return {
    product: 25,
    technical: 25,
    presentation: 25,
    impact: 25,
  };
}

function defaultTracks(): ContestTrack[] {
  return [{ id: "general", name: "General", active: true }];
}

function defaultRounds(): ContestRound[] {
  return [{ id: "final", name: "Final", active: true }];
}

function normalizeTracks(tracks: ContestTrack[] | undefined): ContestTrack[] {
  const list = Array.isArray(tracks) ? tracks : [];
  const cleaned = list
    .map((t) => ({
      id: String(t.id ?? "").trim(),
      name: String(t.name ?? "").trim(),
      description: t.description ?? null,
      active: t.active ?? true,
      rubric: t.rubric,
    }))
    .filter((t) => t.id.length > 0 && t.name.length > 0);
  return cleaned.length > 0 ? cleaned : defaultTracks();
}

function normalizeRounds(rounds: ContestRound[] | undefined): ContestRound[] {
  const list = Array.isArray(rounds) ? rounds : [];
  const cleaned = list
    .map((r) => ({
      id: String(r.id ?? "").trim(),
      name: String(r.name ?? "").trim(),
      opens_at: r.opens_at ?? null,
      closes_at: r.closes_at ?? null,
      active: r.active ?? true,
    }))
    .filter((r) => r.id.length > 0 && r.name.length > 0);
  return cleaned.length > 0 ? cleaned : defaultRounds();
}

/** Effective ISO deadline for locking submissions; explicit `submission_deadline` or fallback `ends_at`. */
export function getEffectiveContestSubmissionDeadline(
  contest: Pick<Contest, "submission_deadline" | "ends_at">,
): string | null {
  const explicit = contest.submission_deadline?.trim();
  if (explicit) return explicit;
  const end = contest.ends_at?.trim();
  return end || null;
}

export function isPastContestSubmissionDeadline(
  contest: Pick<Contest, "submission_deadline" | "ends_at">,
): boolean {
  const iso = getEffectiveContestSubmissionDeadline(contest);
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() > ms;
}

/** Effective ISO deadline for locking registrations; explicit `registration_deadline` or fallback `submission_deadline`/`ends_at`. */
export function getEffectiveContestRegistrationDeadline(
  contest: Pick<Contest, "registration_deadline" | "submission_deadline" | "ends_at">,
): string | null {
  const explicit = contest.registration_deadline?.trim();
  if (explicit) return explicit;
  const submission = contest.submission_deadline?.trim();
  if (submission) return submission;
  const end = contest.ends_at?.trim();
  return end || null;
}

export function isPastContestRegistrationDeadline(
  contest: Pick<Contest, "registration_deadline" | "submission_deadline" | "ends_at">,
): boolean {
  const iso = getEffectiveContestRegistrationDeadline(contest);
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() > ms;
}

function normalizeContest(data: Contest): Contest {
  const rounds = normalizeRounds(data.rounds);
  const judgingActiveRoundId =
    data.judging?.active_round_id && rounds.some((r) => r.id === data.judging?.active_round_id)
      ? data.judging.active_round_id
      : rounds[0]?.id ?? "final";

  return {
    ...data,
    slug: sanitizeSlug(data.slug),
    judge_emails: sanitizeEmailList(data.judge_emails),
    co_organizer_emails: sanitizeEmailList(data.co_organizer_emails),
    co_host_viewer_emails: sanitizeEmailList(data.co_host_viewer_emails),
    partner_viewer_emails: sanitizeEmailList(data.partner_viewer_emails),
    mentor_emails: sanitizeEmailList(data.mentor_emails),
    reviewer_emails: sanitizeEmailList(data.reviewer_emails),
    config: {
      anonymous_judging: false,
      auto_approve_registrations: false,
      ...(data.config ?? {}),
    },
    tracks: normalizeTracks(data.tracks),
    rounds,
    judging: { ...(data.judging ?? {}), active_round_id: judgingActiveRoundId },
    rubric_weights: data.rubric_weights ?? defaultRubricWeights(),
    metrics_snapshot: data.metrics_snapshot ?? emptyMetricsSnapshot(),
    published_leaderboard: data.published_leaderboard ?? [],
    winner_announcements: data.winner_announcements ?? [],
    cover_image_url: data.cover_image_url?.trim() || null,
    cover_image_path: data.cover_image_path?.trim() || null,
    thumbnail_url: data.thumbnail_url?.trim() || null,
    thumbnail_path: data.thumbnail_path?.trim() || null,
    prize_pool_summary: data.prize_pool_summary?.trim() || null,
    prizes: sanitizePrizeEntries(data.prizes),
    faqs: sanitizeFaqEntries(data.faqs),
    timeline_milestones: sanitizeTimelineMilestones(data.timeline_milestones ?? []),
    organizational_partners: sanitizeOrganizationalPartners(data.organizational_partners),
    resources: Array.isArray(data.resources) ? data.resources : undefined,
    badges: Array.isArray(data.badges) ? data.badges : undefined,
    official_course_id:
      [data.official_course_id, data.officialCourseId]
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .find((s) => s.length > 0) ?? null,
    related_course_ids: Array.isArray(data.related_course_ids)
      ? data.related_course_ids.map(String)
      : Array.isArray(data.relatedCourseIds)
        ? data.relatedCourseIds.map(String)
        : undefined,
    related_career_track_ids: Array.isArray(data.related_career_track_ids)
      ? data.related_career_track_ids.map(String)
      : Array.isArray(data.relatedCareerTrackIds)
        ? data.relatedCareerTrackIds.map(String)
        : undefined,
    track_id:
      [data.track_id, data.trackId]
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .find((s) => s.length > 0) ?? null,
    submission_deadline: data.submission_deadline?.trim() || null,
  };
}

function normalizeRegistration(data: ContestRegistration): ContestRegistration {
  return {
    ...data,
    team_members: sanitizeStringList(data.team_members),
  };
}

function contestFromRow(row: {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  document: Record<string, unknown> | null;
}): Contest {
  const doc = row.document ?? {};
  return normalizeContest({
    id: row.id,
    judge_emails: [],
    co_organizer_emails: [],
    co_host_viewer_emails: [],
    partner_viewer_emails: [],
    mentor_emails: [],
    reviewer_emails: [],
    metrics_snapshot: emptyMetricsSnapshot(),
    rubric_weights: defaultRubricWeights(),
    published_leaderboard: [],
    winner_announcements: [],
    ...doc,
    status: (doc.status as Contest["status"]) ?? (row.status as Contest["status"]),
    created_at: (doc.created_at as string) ?? row.created_at,
    updated_at: (doc.updated_at as string) ?? row.updated_at,
  } as unknown as Contest);
}

function registrationFromRow(row: {
  id: string;
  hackathon_id?: string;
  contest_id?: string;
  user_id: string;
  document: Record<string, unknown> | null;
}): ContestRegistration {
  const d = row.document ?? {};
  const contest_id = String(row.hackathon_id ?? row.contest_id ?? "");
  return normalizeRegistration({
    id: row.id,
    contest_id,
    user_id: row.user_id,
    ...d,
  } as ContestRegistration);
}

async function requireCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return user;
}

async function requireContestManager(): Promise<{ uid: string }> {
  const user = await requireCurrentUser();
  const profile = await getProfileForUser(user);
  if (!canManageContests(profile)) {
    throw new Error("forbidden:manage_contest");
  }
  return { uid: user.id };
}

async function requireContestScorer(
  contestId: string,
  prefetch?: PrefetchedContestActorContext,
): Promise<{ contest: Contest; user: User }> {
  if (prefetch && prefetch.contest.id === contestId) {
    if (!canScoreContest(prefetch.contest, prefetch.profile, prefetch.viewer.email)) {
      throw new Error("forbidden:score_contest");
    }
    return { contest: prefetch.contest, user: prefetch.viewer };
  }
  const user = await requireCurrentUser();
  const [profile, contest] = await Promise.all([getProfileForUser(user), getContest(contestId)]);
  if (!contest) throw new Error("not_found:contest");
  if (!canScoreContest(contest, profile, user.email)) {
    throw new Error("Bạn không có quyền chấm điểm contest này.");
  }
  return { contest, user };
}

async function requireContestReviewer(
  contestId: string,
  prefetch?: PrefetchedContestActorContext,
): Promise<Contest> {
  if (prefetch && prefetch.contest.id === contestId) {
    if (!canReviewContestApplications(prefetch.contest, prefetch.profile)) {
      throw new Error("forbidden:review_applications");
    }
    return prefetch.contest;
  }
  const user = await requireCurrentUser();
  const [profile, contest] = await Promise.all([getProfileForUser(user), getContest(contestId)]);
  if (!contest) throw new Error("not_found:contest");
  if (!canReviewContestApplications(contest, profile)) {
    throw new Error("Bạn không có quyền duyệt hồ sơ contest này.");
  }
  return contest;
}

/**
 * List contests visible to the viewer.
 * @param viewer - When provided (after auth init), skips `getUser()` (reduces auth lock contention).
 * Pass `null` for anonymous; omit only for legacy callers that must resolve the session internally.
 */
export async function listContests(viewer?: User | null): Promise<Contest[]>;
export async function listContests(viewer: User | null, uiLocale: string | null): Promise<Contest[]>;
export async function listContests(
  viewer?: User | null,
  uiLocale?: string | null,
): Promise<Contest[]> {
  const normalizedUiLocale = normalizeContentLocale(uiLocale ?? i18n.resolvedLanguage ?? i18n.language);

  let user: User | null = null;
  if (viewer === undefined) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u ?? null;
  } else {
    user = viewer;
  }
  const profile = user ? await getProfileForUser(user).catch(() => null) : null;
  const isManager = canManageContests(profile);
  const cacheKey = `${isManager ? "manager" : "public"}:${normalizedUiLocale}`;

  const inflight = listContestsInFlight.get(cacheKey);
  if (inflight) return inflight;

  const cached = contestListCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    let q = supabase
      .from("hackathons")
      .select(CONTEST_ROW_SELECT)
      .order("updated_at", { ascending: false });
    if (!isManager) {
      q = q.in("status", PUBLIC_CONTEST_STATUSES);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const contests = (data ?? []).map((r) =>
      contestFromRow(r as Parameters<typeof contestFromRow>[0]),
    );

    const idsByLocale = new Map<Locale, string[]>();
    for (const contest of contests) {
      const desired = pickContentLocale(contest.i18n ?? null, normalizedUiLocale);
      const list = idsByLocale.get(desired) ?? [];
      list.push(contest.id);
      idsByLocale.set(desired, list);
    }

    const localeMaps = new Map<Locale, Map<string, ContestI18nContent>>();
    await Promise.all(
      Array.from(idsByLocale.entries()).map(async ([locale, ids]) => {
        localeMaps.set(locale, await getBatchHackathonLocaleContent(ids, locale));
      }),
    );

    return contests.map((contest) => {
      const desired = pickContentLocale(contest.i18n ?? null, normalizedUiLocale);
      const localized = localeMaps.get(desired)?.get(contest.id) ?? null;
      return applyContestLocaleContent(contest, localized);
    });
  })();

  listContestsInFlight.set(cacheKey, promise);
  promise.finally(() => {
    listContestsInFlight.delete(cacheKey);
  });

  contestListCache.set(cacheKey, promise);
  promise.catch(() => contestListCache.delete(cacheKey));
  return promise;
}

export function invalidateContestListCache() {
  contestListCache.clear();
  listContestsInFlight.clear();
}

export async function hasHackathonCoOrganizerAccess(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  // Best-effort: check if any hackathon lists this email as co_organizer.
  // Stored inside `document` JSON; we query via PostgREST JSON contains filter.
  const { data, error } = await supabase
    .from("hackathons")
    .select("id")
    .filter("document->co_organizer_emails", "cs", JSON.stringify([normalized]))
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function getContest(contestId: string, uiLocale?: string | null): Promise<Contest | null> {
  const normalizedUiLocale = normalizeContentLocale(uiLocale ?? i18n.resolvedLanguage ?? i18n.language);
  const inflightKey = `${contestId}:${normalizedUiLocale}`;

  const existing = getContestByIdInFlight.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("hackathons")
      .select(CONTEST_ROW_SELECT)
      .eq("id", contestId)
      .maybeSingle();
    if (error || !data) return null;
    const contest = contestFromRow(data as Parameters<typeof contestFromRow>[0]);
    const desired = pickContentLocale(contest.i18n ?? null, normalizedUiLocale);
    const localized = await getHackathonLocaleContent(contest.id, desired);
    return applyContestLocaleContent(contest, localized);
  })();

  getContestByIdInFlight.set(inflightKey, promise);
  promise.finally(() => {
    if (getContestByIdInFlight.get(inflightKey) === promise) {
      getContestByIdInFlight.delete(inflightKey);
    }
  });

  return promise;
}

export async function getContestBySlug(slug: string, uiLocale?: string | null): Promise<Contest | null> {
  const normalizedUiLocale = normalizeContentLocale(uiLocale ?? i18n.resolvedLanguage ?? i18n.language);

  const normalized = sanitizeSlug(slug);
  if (!normalized) return null;

  const inflightKey = `${normalized}:${normalizedUiLocale}`;
  const existing = getContestBySlugInFlight.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("hackathons")
      .select(CONTEST_ROW_SELECT)
      .eq("document->>slug", normalized)
      .maybeSingle();
    if (error || !data) return null;
    const contest = contestFromRow(data as Parameters<typeof contestFromRow>[0]);
    const desired = pickContentLocale(contest.i18n ?? null, normalizedUiLocale);
    const localized = await getHackathonLocaleContent(contest.id, desired);
    return applyContestLocaleContent(contest, localized);
  })();

  getContestBySlugInFlight.set(inflightKey, promise);
  promise.finally(() => {
    if (getContestBySlugInFlight.get(inflightKey) === promise) {
      getContestBySlugInFlight.delete(inflightKey);
    }
  });

  return promise;
}

export async function createContest(data: ContestInsert): Promise<Contest> {
  const { uid } = await requireContestManager();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const document = removeUndefinedFields({
    slug: sanitizeSlug(data.slug),
    title: data.title.trim(),
    tagline: data.tagline.trim(),
    description: data.description?.trim() || null,
    rules: data.rules?.trim() || null,
    starts_at: data.starts_at ?? null,
    ends_at: data.ends_at ?? null,
    location: data.location ?? "hybrid",
    cover_image_url: data.cover_image_url ?? null,
    cover_image_path: data.cover_image_path ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
    thumbnail_path: data.thumbnail_path ?? null,
    registration_deadline: data.registration_deadline ?? null,
    submission_deadline: data.submission_deadline ?? null,
    max_participants: data.max_participants ?? null,
    judge_emails: sanitizeEmailList(data.judge_emails),
    co_organizer_emails: sanitizeEmailList(data.co_organizer_emails),
    co_host_viewer_emails: sanitizeEmailList(data.co_host_viewer_emails),
    partner_viewer_emails: sanitizeEmailList(data.partner_viewer_emails),
    mentor_emails: sanitizeEmailList(data.mentor_emails),
    reviewer_emails: sanitizeEmailList(data.reviewer_emails),
    rubric_weights: data.rubric_weights ?? defaultRubricWeights(),
    metrics_snapshot: emptyMetricsSnapshot(),
    published_leaderboard: [],
    winner_announcements: [],
    prize_pool_summary: data.prize_pool_summary?.trim() || null,
    prizes: sanitizePrizeEntries(data.prizes),
    faqs: sanitizeFaqEntries(data.faqs),
    timeline_milestones: sanitizeTimelineMilestones(data.timeline_milestones ?? []),
    organizational_partners: sanitizeOrganizationalPartners(data.organizational_partners),
    created_by: uid,
    updated_by: uid,
    created_at: now,
    updated_at: now,
  }) as Record<string, unknown>;

  const status = (data.status ?? "draft") as Contest["status"];
  const { error } = await supabase.from("hackathons").insert({
    id,
    status,
    created_at: now,
    updated_at: now,
    document,
  });
  if (error) throw new Error(error.message);
  const created = await getContest(id);
  if (created) return created;
  return normalizeContest({ id, status, ...document } as unknown as Contest);
}

export async function updateContest(contestId: string, updates: ContestUpdate): Promise<void> {
  const { uid } = await requireContestManager();
  const { data: row, error: fetchErr } = await supabase
    .from("hackathons")
    .select("*")
    .eq("id", contestId)
    .single();
  if (fetchErr || !row) throw new Error(fetchErr?.message ?? "not_found:contest");

  const prevDoc = (row.document ?? {}) as Record<string, unknown>;
  const payload = removeUndefinedFields({
    slug: updates.slug === undefined ? undefined : sanitizeSlug(updates.slug),
    title: updates.title?.trim(),
    tagline: updates.tagline?.trim(),
    description:
      updates.description === undefined ? undefined : updates.description?.trim() || null,
    rules: updates.rules === undefined ? undefined : updates.rules?.trim() || null,
    starts_at: updates.starts_at,
    ends_at: updates.ends_at,
    location: updates.location,
    cover_image_url: updates.cover_image_url,
    cover_image_path: updates.cover_image_path,
    thumbnail_url: updates.thumbnail_url,
    thumbnail_path: updates.thumbnail_path,
    registration_deadline: updates.registration_deadline,
    submission_deadline: updates.submission_deadline,
    max_participants: updates.max_participants,
    judge_emails: updates.judge_emails && sanitizeEmailList(updates.judge_emails),
    co_organizer_emails:
      updates.co_organizer_emails &&
      sanitizeEmailList(updates.co_organizer_emails),
    co_host_viewer_emails:
      updates.co_host_viewer_emails &&
      sanitizeEmailList(updates.co_host_viewer_emails),
    partner_viewer_emails:
      updates.partner_viewer_emails &&
      sanitizeEmailList(updates.partner_viewer_emails),
    mentor_emails: updates.mentor_emails && sanitizeEmailList(updates.mentor_emails),
    reviewer_emails:
      updates.reviewer_emails && sanitizeEmailList(updates.reviewer_emails),
    rubric_weights: updates.rubric_weights,
    metrics_snapshot: updates.metrics_snapshot,
    published_leaderboard: updates.published_leaderboard,
    winner_announcements: updates.winner_announcements,
    prize_pool_summary:
      updates.prize_pool_summary === undefined
        ? undefined
        : updates.prize_pool_summary?.trim() || null,
    prizes: updates.prizes !== undefined ? sanitizePrizeEntries(updates.prizes) : undefined,
    faqs: updates.faqs !== undefined ? sanitizeFaqEntries(updates.faqs) : undefined,
    timeline_milestones:
      updates.timeline_milestones !== undefined
        ? sanitizeTimelineMilestones(updates.timeline_milestones)
        : undefined,
    organizational_partners:
      updates.organizational_partners !== undefined
        ? sanitizeOrganizationalPartners(updates.organizational_partners)
        : undefined,
    i18n: updates.i18n,
    updated_by: uid,
    updated_at: new Date().toISOString(),
  }) as Record<string, unknown>;

  const nextDoc = { ...prevDoc, ...payload };
  const nextStatus = updates.status ?? (row.status as string);
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("hackathons")
    .update({ status: nextStatus, document: nextDoc, updated_at: now })
    .eq("id", contestId);
  if (error) throw new Error(error.message);
}

export async function deleteContest(contestId: string): Promise<void> {
  await requireContestManager();

  const existing = await getContest(contestId);
  await deleteStorageObjectByPath(existing?.cover_image_path);
  await deleteStorageObjectByPath(existing?.thumbnail_path);
  for (const p of existing?.organizational_partners ?? []) {
    await deleteStorageObjectByPath(p.logo_path);
  }

  const { error } = await supabase.from("hackathons").delete().eq("id", contestId);
  if (error) throw new Error(error.message);
}

export async function getMyContestRegistration(
  contestId: string,
  viewer?: User | null,
): Promise<ContestRegistration | null> {
  let user: User | null = null;
  if (viewer === undefined) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u ?? null;
  } else {
    user = viewer;
  }
  if (!user) return null;

  const id = contestRegistrationId(contestId, user.id);
  const { data, error } = await supabase
    .from("hackathon_registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return registrationFromRow(data as Parameters<typeof registrationFromRow>[0]);
}

export async function registerForContest(
  contestId: string,
  input: ContestRegistrationInsert,
): Promise<ContestRegistration> {
  const user = await requireCurrentUser();
  const profile = await getProfileForUser(user);
  const contest = await getContest(contestId);
  if (!contest) throw new Error("not_found:contest");
  const now = new Date().toISOString();
  const registrationId = contestRegistrationId(contestId, user.id);
  const autoApprove = Boolean(contest.config?.auto_approve_registrations);

  const document = removeUndefinedFields({
    status: (autoApprove ? "approved" : "pending") as ContestRegistrationStatus,
    motivation: input.motivation?.trim() || null,
    contact_email: input.contact_email?.trim() || user.email || profile?.email || null,
    contact_phone: input.contact_phone?.trim() || profile?.phone || null,
    portfolio_url: input.portfolio_url?.trim() || null,
    user_full_name:
      input.user_full_name?.trim() || profile?.full_name || (user.user_metadata?.full_name as string) || null,
    reviewed_at: autoApprove ? now : null,
    reviewed_by: null,
    review_note: null,
    applied_at: now,
    updated_at: now,
  }) as Record<string, unknown>;

  const { error } = await supabase.from("hackathon_registrations").insert({
    id: registrationId,
    hackathon_id: contestId,
    user_id: user.id,
    document,
  });
  if (error) throw new Error(error.message);
  return normalizeRegistration({
    id: registrationId,
    contest_id: contestId,
    user_id: user.id,
    ...document,
  } as ContestRegistration);
}

export async function getContestRegistrations(
  contestId: string,
  options?: {
    status?: ContestRegistrationStatus | "all";
    prefetch?: PrefetchedContestActorContext;
    limit?: number;
  },
): Promise<ContestRegistration[]> {
  await requireContestReviewer(contestId, options?.prefetch);

  const limit = Math.min(options?.limit ?? 500, 500);
  let q = supabase
    .from("hackathon_registrations")
    .select("*")
    .eq("hackathon_id", contestId)
    .limit(limit);
  if (options?.status && options.status !== "all") {
    q = q.filter("document->>status", "eq", options.status);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => registrationFromRow(d as Parameters<typeof registrationFromRow>[0]));
}

export async function reviewContestRegistration(
  contestId: string,
  userId: string,
  input: ContestRegistrationReviewInput,
): Promise<void> {
  const user = await requireCurrentUser();
  await requireContestReviewer(contestId, undefined);
  const id = contestRegistrationId(contestId, userId);
  const { data: row, error: fe } = await supabase
    .from("hackathon_registrations")
    .select("*")
    .eq("id", id)
    .single();
  if (fe || !row) throw new Error(fe?.message ?? "not_found:registration");
  const doc = (row.document ?? {}) as Record<string, unknown>;
  const next = {
    ...doc,
    status: input.status,
    review_note: input.review_note?.trim() || null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("hackathon_registrations")
    .update({ document: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (input.status === "approved" || input.status === "rejected") {
    void invokeCoreliaApi("hackathons.notifyRegistrationReview", {
      hackathon_id: contestId,
      applicant_user_id: userId,
    });
  }
}

export type BlastEmailFilter = "all" | "approved" | "pending" | "rejected";

export type BlastEmailResult = {
  ok: boolean;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  reason?: string;
};

export async function blastContestEmail(
  contestId: string,
  params: { subject: string; html: string; recipientFilter: BlastEmailFilter },
): Promise<BlastEmailResult> {
  return callCoreliaApi<BlastEmailResult>("hackathons.blastEmail", {
    hackathon_id: contestId,
    subject: params.subject,
    html: params.html,
    recipient_filter: params.recipientFilter,
  });
}

export async function getMyContestAccessInvite(
  contestId: string,
  viewer?: User | null,
): Promise<ContestAccessInvite | null> {
  let user: User | null = null;
  if (viewer === undefined) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u ?? null;
  } else {
    user = viewer;
  }
  if (!user?.email) return null;
  const id = contestInviteId(contestId, user.email);
  const { data, error } = await supabase
    .from("hackathon_access_invites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const d = data.document as Record<string, unknown>;
  const hackathonId = getHackathonIdFromRow(data as unknown as Record<string, unknown>);
  if (!hackathonId) return null;
  return { id: data.id, contest_id: hackathonId, ...d } as ContestAccessInvite;
}

export async function listContestAccessInvites(
  contestId: string,
): Promise<ContestAccessInvite[]> {
  await requireContestManager();
  const { data, error } = await supabase
    .from("hackathon_access_invites")
    .select("*")
    .eq("hackathon_id", contestId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => {
      const d = row.document as Record<string, unknown>;
      const hackathonId = getHackathonIdFromRow(row as unknown as Record<string, unknown>);
      return {
        id: row.id,
        contest_id: hackathonId ?? contestId,
        ...d,
      } as ContestAccessInvite;
    })
    .sort((a, b) => String(b.invited_at ?? "").localeCompare(String(a.invited_at ?? "")));
}

export async function createContestAccessInvite(
  contestId: string,
  input: ContestAccessInviteInsert,
): Promise<void> {
  const { uid } = await requireContestManager();
  const contest = await getContest(contestId);
  if (!contest) throw new Error("not_found:contest");

  const email = sanitizeEmail(input.email);
  if (!email) throw new Error("invalid_input:invite_email");

  const roles = Array.from(new Set(input.roles));
  const inviteId = contestInviteId(contestId, email);
  const now = new Date().toISOString();

  const document = {
    email,
    roles,
    display_name: input.display_name?.trim() || null,
    organization_name: input.organization_name?.trim() || null,
    note: input.note?.trim() || null,
    status: "pending",
    invited_by: uid,
    invited_at: now,
    responded_at: null,
  };

  await supabase.from("hackathon_access_invites").upsert(
    { id: inviteId, hackathon_id: contestId, document },
    { onConflict: "id" },
  );

  const nextJudgeEmails = roles.includes("judge")
    ? Array.from(new Set([...contest.judge_emails, email]))
    : contest.judge_emails.filter((item) => item !== email);
  const nextCoOrganizerEmails = roles.includes("co_organizer")
    ? Array.from(new Set([...(contest.co_organizer_emails ?? []), email]))
    : (contest.co_organizer_emails ?? []).filter((item) => item !== email);
  const nextCoHostViewerEmails = roles.includes("co_host_viewer")
    ? Array.from(new Set([...contest.co_host_viewer_emails, email]))
    : contest.co_host_viewer_emails.filter((item) => item !== email);
  const nextPartnerViewerEmails = roles.includes("partner_viewer")
    ? Array.from(new Set([...(contest.partner_viewer_emails ?? []), email]))
    : (contest.partner_viewer_emails ?? []).filter((item) => item !== email);
  const nextMentorEmails = roles.includes("mentor")
    ? Array.from(new Set([...(contest.mentor_emails ?? []), email]))
    : (contest.mentor_emails ?? []).filter((item) => item !== email);
  const nextReviewerEmails = roles.includes("reviewer")
    ? Array.from(new Set([...(contest.reviewer_emails ?? []), email]))
    : (contest.reviewer_emails ?? []).filter((item) => item !== email);

  await updateContest(contestId, {
    judge_emails: nextJudgeEmails,
    co_organizer_emails: nextCoOrganizerEmails,
    co_host_viewer_emails: nextCoHostViewerEmails,
    partner_viewer_emails: nextPartnerViewerEmails,
    mentor_emails: nextMentorEmails,
    reviewer_emails: nextReviewerEmails,
  });
}

export async function respondToContestAccessInvite(
  contestId: string,
  status: Extract<ContestAccessInvite["status"], "accepted" | "declined">,
): Promise<void> {
  const user = await requireCurrentUser();
  if (!user.email) throw new Error("missing_email:account");
  const id = contestInviteId(contestId, user.email);
  const { data: row, error: fe } = await supabase
    .from("hackathon_access_invites")
    .select("*")
    .eq("id", id)
    .single();
  if (fe || !row) throw new Error(fe?.message ?? "not_found:invite");
  const doc = (row.document ?? {}) as Record<string, unknown>;
  const next = { ...doc, status, responded_at: new Date().toISOString() };
  const { error } = await supabase
    .from("hackathon_access_invites")
    .update({ document: next })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function revokeContestAccessInvite(
  contestId: string,
  email: string,
): Promise<void> {
  await requireContestManager();
  const normalized = sanitizeEmail(email);
  const id = contestInviteId(contestId, normalized);
  const { data: row, error: fe } = await supabase
    .from("hackathon_access_invites")
    .select("*")
    .eq("id", id)
    .single();
  if (!fe && row) {
    const doc = (row.document ?? {}) as Record<string, unknown>;
    const next = { ...doc, status: "revoked", responded_at: new Date().toISOString() };
    await supabase
      .from("hackathon_access_invites")
      .update({ document: next })
      .eq("id", id);
  }

  const contest = await getContest(contestId);
  if (!contest) return;
  await updateContest(contestId, {
    judge_emails: contest.judge_emails.filter((item) => item !== normalized),
    co_organizer_emails: (contest.co_organizer_emails ?? []).filter((item) => item !== normalized),
    co_host_viewer_emails: contest.co_host_viewer_emails.filter(
      (item) => item !== normalized,
    ),
    partner_viewer_emails: (contest.partner_viewer_emails ?? []).filter(
      (item) => item !== normalized,
    ),
    mentor_emails: (contest.mentor_emails ?? []).filter((item) => item !== normalized),
    reviewer_emails: (contest.reviewer_emails ?? []).filter((item) => item !== normalized),
  });
}

export async function getMyContestSubmission(
  contestId: string,
  viewer?: User | null,
): Promise<ContestSubmission | null> {
  let user: User | null = null;
  if (viewer === undefined) {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    user = u ?? null;
  } else {
    user = viewer;
  }
  if (!user) return null;
  const id = contestSubmissionId(contestId, user.id);
  const { data, error } = await supabase
    .from("hackathon_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const d = data.document as Record<string, unknown>;
  const hackathonId = getHackathonIdFromRow(data as unknown as Record<string, unknown>);
  if (!hackathonId) return null;
  return {
    id: data.id,
    contest_id: hackathonId,
    user_id: data.user_id,
    ...d,
  } as ContestSubmission;
}

export async function upsertContestSubmission(
  contestId: string,
  input: ContestSubmissionInsert,
): Promise<ContestSubmission> {
  const user = await requireCurrentUser();
  const contest = await getContest(contestId);
  if (!contest) throw new Error("not_found:contest");
  const registration = await getMyContestRegistration(contestId, user);
  if (!registration || registration.status !== "approved") {
    throw new Error("forbidden:submission_not_approved");
  }

  if (isPastContestSubmissionDeadline(contest)) {
    throw new Error("forbidden:submission_deadline_passed");
  }

  const existing = await getMyContestSubmission(contestId, user);
  const now = new Date().toISOString();
  const submissionId = contestSubmissionId(contestId, user.id);
  const trackId = contest.tracks?.[0]?.id ?? "general";
  const displayId = existing?.display_id ?? generateDisplayId();
  const document = removeUndefinedFields({
    registration_id: registration.id,
    team_name: existing?.team_name ?? null,
    team_members: Array.isArray(existing?.team_members) ? existing.team_members : [],
    contestant_name:
      registration.user_full_name ?? (user.user_metadata?.full_name as string) ?? null,
    track_id: existing?.track_id ?? trackId,
    display_id: displayId,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    demo_url: input.demo_url?.trim() || null,
    repo_url: input.repo_url?.trim() || null,
    slide_url: input.slide_url?.trim() || null,
    screenshot_url: input.screenshot_url?.trim() || null,
    cover_image_url: input.cover_image_url?.trim() || null,
    video_url: input.video_url?.trim() || null,
    submitted_at: now,
    updated_at: now,
  }) as Record<string, unknown>;

  const { error } = await supabase.from("hackathon_submissions").upsert(
    {
      id: submissionId,
      hackathon_id: contestId,
      user_id: user.id,
      document,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  return {
    id: submissionId,
    contest_id: contestId,
    user_id: user.id,
    ...document,
  } as ContestSubmission;
}

export async function listContestSubmissions(
  contestId: string,
  prefetch?: PrefetchedContestActorContext,
  limit = 500,
): Promise<ContestSubmission[]> {
  const clampedLimit = Math.min(limit, 500);

  function mapSubmission(row: Record<string, unknown>): ContestSubmission {
    const d = row.document as Record<string, unknown>;
    const hid = getHackathonIdFromRow(row);
    return {
      id: row.id,
      contest_id: hid ?? contestId,
      user_id: row.user_id,
      ...d,
    } as ContestSubmission;
  }

  if (prefetch && prefetch.contest.id === contestId) {
    const { viewer: user, contest, profile } = prefetch;
    const canSeeAll =
      canScoreContest(contest, profile, user.email ?? undefined) ||
      canManageContests(profile);
    let q = supabase
      .from("hackathon_submissions")
      .select("*")
      .eq("hackathon_id", contestId)
      .limit(clampedLimit);
    if (!canSeeAll) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapSubmission(row as Record<string, unknown>));
  }

  const user = await requireCurrentUser();
  const [profile, contest] = await Promise.all([getProfileForUser(user), getContest(contestId)]);
  if (!contest) throw new Error("not_found:contest");

  const canSeeAll = canScoreContest(contest, profile, user.email) || canManageContests(profile);
  let q = supabase
    .from("hackathon_submissions")
    .select("*")
    .eq("hackathon_id", contestId)
    .limit(clampedLimit);
  if (!canSeeAll) q = q.eq("user_id", user.id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapSubmission(row as Record<string, unknown>));
}

export async function listContestScores(
  contestId: string,
  prefetch?: PrefetchedContestActorContext,
  limit = 500,
): Promise<ContestScore[]> {
  await requireContestScorer(contestId, prefetch);
  const { data, error } = await supabase
    .from("hackathon_scores")
    .select("*")
    .eq("hackathon_id", contestId)
    .limit(Math.min(limit, 500));
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const d = row.document as Record<string, unknown>;
    const hackathonId = getHackathonIdFromRow(row as unknown as Record<string, unknown>);
    return {
      id: row.id,
      contest_id: hackathonId ?? contestId,
      ...d,
    } as ContestScore;
  });
}

export async function scoreContestSubmission(
  contestId: string,
  submissionId: string,
  input: ContestScoreInput,
): Promise<void> {
  const { contest, user } = await requireContestScorer(contestId);
  const now = new Date().toISOString();
  const weights = contest.rubric_weights ?? defaultRubricWeights();
  const roundId = contest.judging?.active_round_id ?? "final";
  const totalScore = Number(
    (
      (input.product_score / 25) * weights.product +
      (input.technical_score / 25) * weights.technical +
      (input.presentation_score / 25) * weights.presentation +
      (input.impact_score / 25) * weights.impact
    ).toFixed(2),
  );

  const scoreId = contestScoreId(submissionId, user.id);
  const document = {
    submission_id: submissionId,
    round_id: roundId,
    judge_uid: user.id,
    judge_email: user.email ?? null,
    product_score: input.product_score,
    technical_score: input.technical_score,
    presentation_score: input.presentation_score,
    impact_score: input.impact_score,
    note: input.note?.trim() || null,
    total_score: totalScore,
    created_at: now,
    updated_at: now,
  };
  const { error } = await supabase.from("hackathon_scores").upsert(
    { id: scoreId, hackathon_id: contestId, document },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

/** Workspace judging preview + persisted published leaderboard (includes public showcase URLs). */
export function buildContestLeaderboard(
  submissions: ContestSubmission[],
  scores: ContestScore[],
): ContestLeaderboardEntry[] {
  const scoreMap = new Map<string, ContestScore[]>();
  for (const score of scores) {
    const list = scoreMap.get(score.submission_id) ?? [];
    list.push(score);
    scoreMap.set(score.submission_id, list);
  }

  return submissions
    .map((submission) => {
      const relatedScores = scoreMap.get(submission.id) ?? [];
      const total = relatedScores.reduce((sum, score) => sum + score.total_score, 0);
      const average = relatedScores.length === 0 ? 0 : total / relatedScores.length;
      return {
        submission_id: submission.id,
        contestant_user_id: submission.user_id,
        contestant_name: submission.contestant_name,
        submission_title: submission.title,
        average_score: Number(average.toFixed(2)),
        score_count: relatedScores.length,
        rank: 0,
        team_name: submission.team_name,
        demo_url: submission.demo_url ?? null,
        repo_url: submission.repo_url ?? null,
        slide_url: submission.slide_url ?? null,
        screenshot_url: submission.screenshot_url ?? null,
        cover_image_url: submission.cover_image_url ?? submission.screenshot_url ?? null,
        video_url: submission.video_url ?? null,
        summary: submission.summary ?? null,
      };
    })
    .sort((a, b) => {
      if (b.average_score !== a.average_score) return b.average_score - a.average_score;
      return b.score_count - a.score_count;
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function refreshContestMetricsSnapshot(
  contestId: string,
): Promise<ContestMetricsSnapshot> {
  const user = await requireCurrentUser();
  const [profile, contest] = await Promise.all([
    getProfileForUser(user),
    getContest(contestId),
  ]);
  if (!contest) throw new Error("not_found:contest");
  if (!canReviewContestApplications(contest, profile)) {
    throw new Error("Bạn không có quyền duyệt hồ sơ contest này.");
  }
  const prefetch: PrefetchedContestActorContext = {
    contest,
    viewer: user,
    profile,
  };
  const [registrations, submissions, scores] = await Promise.all([
    getContestRegistrations(contestId, { status: "all", prefetch }),
    listContestSubmissions(contestId, prefetch),
    listContestScores(contestId, prefetch).catch(() => []),
  ]);

  const scoredSubmissions = new Set(scores.map((score) => score.submission_id));
  const snapshot: ContestMetricsSnapshot = {
    registrations_total: registrations.length,
    pending_registrations: registrations.filter((item) => item.status === "pending").length,
    approved_registrations: registrations.filter((item) => item.status === "approved").length,
    rejected_registrations: registrations.filter((item) => item.status === "rejected").length,
    submissions_total: submissions.length,
    scored_submissions: scoredSubmissions.size,
    published_winners: contest.winner_announcements.length,
    updated_at: new Date().toISOString(),
  };

  await updateContest(contestId, { metrics_snapshot: snapshot });
  return snapshot;
}

export async function publishContestResults(
  contestId: string,
  winnerInputs: ContestWinnerInput[],
): Promise<{
  leaderboard: ContestLeaderboardEntry[];
  winners: ContestWinner[];
}> {
  await requireContestManager();
  const [submissions, scores] = await Promise.all([
    listContestSubmissions(contestId),
    listContestScores(contestId),
  ]);
  const leaderboard = buildContestLeaderboard(submissions, scores);
  const winnerMap = new Map(leaderboard.map((entry) => [entry.submission_id, entry]));
  const winners: ContestWinner[] = winnerInputs
    .map<ContestWinner | null>((input) => {
      const entry = winnerMap.get(input.submission_id);
      if (!entry) return null;
      return {
        submission_id: input.submission_id,
        contestant_user_id: entry.contestant_user_id,
        contestant_name: entry.contestant_name,
        submission_title: entry.submission_title,
        award_title: input.award_title.trim(),
        note: input.note?.trim() || null,
        average_score: entry.average_score,
        team_name: entry.team_name,
        announced_at: new Date().toISOString(),
      };
    })
    .filter((value): value is ContestWinner => value !== null);

  await updateContest(contestId, {
    published_leaderboard: leaderboard,
    winner_announcements: winners,
    metrics_snapshot: {
      ...(await getContest(contestId))!.metrics_snapshot,
      published_winners: winners.length,
      updated_at: new Date().toISOString(),
    },
  });

  return { leaderboard, winners };
}
