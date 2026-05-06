import { useEffect, useState } from "react";
import { NavLink, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink, ShieldAlert, User } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicProfileByHandle } from "@/lib/profile";
import { getPublishedCoursesByInstructor } from "@/lib/courses";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/stores/authStore";
import { getRoleLabel, type PublicProfile } from "@/types/database";
import type { Course } from "@/types/courses";
import type { Contest } from "@/types/contests";

function profileTitle(p: PublicProfile): string {
  return p.full_name?.trim() || p.username?.trim() || p.ocid?.trim() || p.id;
}

function profileHandle(p: PublicProfile): string | null {
  const u = p.username?.trim();
  if (u) return `@${u}`;
  const ocid = p.ocid?.trim();
  if (ocid) return ocid;
  return null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function UserProfileLayout() {
  const { t } = useTranslation("common");
  const { handle } = useParams<{ handle: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setProfile(null);

      try {
        const h = handle?.trim() ?? "";
        const p = await getPublicProfileByHandle(h);
        if (cancelled) return;
        if (!p) {
          setError(t("userProfile.errors.notFound"));
          return;
        }
        setProfile(p);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [handle, t]);

  const isSelf = Boolean(user && profile && user.id === profile.id);
  const headerHandle = profile ? profileHandle(profile) : null;
  const website = profile?.website?.trim() || profile?.instructor_website?.trim() || null;
  const bio = profile?.bio?.trim() || profile?.instructor_bio?.trim() || null;

  return (
    <div className="container-app py-6 sm:py-8">
      <section className="overflow-hidden rounded-md border border-border-subtle bg-card shadow-card">
        <div className="relative p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_40%),linear-gradient(180deg,color-mix(in_oklch,var(--primary-container)_48%,transparent),transparent_70%)]" />

          <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              {loading ? (
                <Skeleton className="size-16 rounded-full sm:size-20" />
              ) : (
                <Avatar size="lg" className="size-16 sm:size-20">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>
                    <User className="size-5" aria-hidden />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0">
                {loading ? (
                  <>
                    <Skeleton className="h-6 w-56 rounded" />
                    <Skeleton className="mt-2 h-4 w-32 rounded" />
                  </>
                ) : profile ? (
                  <>
                    <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                      {profileTitle(profile)}
                    </h1>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {headerHandle ? <span className="truncate">{headerHandle}</span> : null}
                      <span className="rounded-full border border-border-subtle bg-background/70 px-2 py-0.5 text-xs font-medium text-foreground">
                        {getRoleLabel(profile.role)}
                      </span>
                      {profile.ocid ? (
                        <span className="truncate">
                          {t("userProfile.labels.ocid", { ocid: profile.ocid })}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("userProfile.errors.notFound")}
                  </p>
                )}

                {!loading && profile ? (
                  <div className="mt-3 space-y-2">
                    {bio ? (
                      <p className="text-sm leading-6 text-muted-foreground">{bio}</p>
                    ) : null}

                    {website && isValidHttpUrl(website) ? (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
                      >
                        {t("userProfile.labels.website")}
                        <ExternalLink className="size-4" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {loading ? <Skeleton className="h-9 w-28 rounded" /> : null}
              {!loading && profile && isSelf ? (
                <NavLink to="/account/profile">
                  <Button variant="outline" size="lg" type="button">
                    {t("userProfile.actions.editProfile")}
                  </Button>
                </NavLink>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <div className="max-w-lg">
              <p className="text-sm font-medium text-foreground">{error}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("userProfile.errors.tryAnother")}
              </p>
            </div>
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <UserProfileOverviewSection profile={profile} />
            <UserProfileAchievementsSection isSelf={isSelf} />
            <UserProfileCoursesSection profile={profile} />
            <UserProfileContestsSection profile={profile} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserProfileOverviewSection({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation("common");

  const headline =
    profile.instructor_headline?.trim() ||
    (profile.role === "instructor" ? t("userProfile.overview.instructorHeadlineFallback") : "");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("userProfile.overview.title")}
        </h2>
        {headline ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{headline}</p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("userProfile.overview.empty")}
          </p>
        )}
      </section>

      <section className="rounded-md border border-border-subtle bg-card p-4 shadow-card sm:p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("userProfile.overview.quickInfo")}
        </h2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>{t("userProfile.labels.role")}</span>
            <span className="font-medium text-foreground">
              {getRoleLabel(profile.role)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{t("userProfile.labels.memberSince")}</span>
            <span className="font-medium text-foreground">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function UserProfileAchievementsSection({ isSelf }: { isSelf: boolean }) {
  const { t } = useTranslation("common");

  if (!isSelf) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.achievements.selfOnly")}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
      {t("userProfile.achievements.openInAchievementsPage")}
      <div className="mt-4">
        <NavLink to="/achievements">
          <Button type="button" variant="outline">
            {t("userProfile.achievements.cta")}
          </Button>
        </NavLink>
      </div>
    </div>
  );
}

function UserProfileCoursesSection({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation("common");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We will later list published instructor courses; for students we keep it private by default.
  if (profile.role !== "instructor") {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.courses.privateByDefault")}
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await getPublishedCoursesByInstructor(profile.id);
        if (cancelled) return;
        setCourses(rows);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, t]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {error}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.courses.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {courses.map((c) => (
        <NavLink
          key={c.id}
          to={`/courses/${c.id}`}
          className="block rounded-md border border-border-subtle bg-card p-4 shadow-card transition hover:bg-muted/40"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {c.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("userProfile.courses.updatedAt", {
                date: new Date(c.updated_at).toLocaleDateString(),
              })}
            </div>
          </div>
        </NavLink>
      ))}
    </div>
  );
}

function UserProfileContestsSection({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation("common");
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function contestFromRow(row: {
    id: string;
    status: string;
    created_at: string;
    updated_at: string;
    document: Record<string, unknown> | null;
  }): Contest {
    const doc = row.document ?? {};
    return {
      id: row.id,
      title: String(doc.title ?? ""),
      tagline: String(doc.tagline ?? ""),
      description: (doc.description as string | null) ?? null,
      rules: (doc.rules as string | null) ?? null,
      status: (doc.status as Contest["status"]) ?? (row.status as Contest["status"]),
      starts_at: (doc.starts_at as string | null) ?? null,
      ends_at: (doc.ends_at as string | null) ?? null,
      location: (doc.location as Contest["location"]) ?? "hybrid",
      cover_image_url: (doc.cover_image_url as string | null) ?? null,
      cover_image_path: (doc.cover_image_path as string | null) ?? null,
      thumbnail_url: (doc.thumbnail_url as string | null) ?? null,
      thumbnail_path: (doc.thumbnail_path as string | null) ?? null,
      registration_deadline: (doc.registration_deadline as string | null) ?? null,
      max_participants: (doc.max_participants as number | null) ?? null,
      judge_emails: Array.isArray(doc.judge_emails) ? (doc.judge_emails as string[]) : [],
      co_host_viewer_emails: Array.isArray(doc.co_host_viewer_emails)
        ? (doc.co_host_viewer_emails as string[])
        : [],
      rubric_weights: (doc.rubric_weights as Contest["rubric_weights"]) ?? {
        product: 25,
        technical: 25,
        presentation: 25,
        impact: 25,
      },
      metrics_snapshot: (doc.metrics_snapshot as Contest["metrics_snapshot"]) ?? {
        registrations_total: 0,
        pending_registrations: 0,
        approved_registrations: 0,
        rejected_registrations: 0,
        submissions_total: 0,
        scored_submissions: 0,
        published_winners: 0,
        updated_at: null,
      },
      published_leaderboard: Array.isArray(doc.published_leaderboard)
        ? (doc.published_leaderboard as Contest["published_leaderboard"])
        : [],
      winner_announcements: Array.isArray(doc.winner_announcements)
        ? (doc.winner_announcements as Contest["winner_announcements"])
        : [],
      prize_pool_summary: (doc.prize_pool_summary as string | null) ?? null,
      prizes: Array.isArray(doc.prizes) ? (doc.prizes as Contest["prizes"]) : [],
      faqs: Array.isArray(doc.faqs) ? (doc.faqs as Contest["faqs"]) : [],
      timeline_milestones: Array.isArray(doc.timeline_milestones)
        ? (doc.timeline_milestones as Contest["timeline_milestones"])
        : [],
      created_by: String(doc.created_by ?? profile.id),
      updated_by: String(doc.updated_by ?? profile.id),
      created_at: String(doc.created_at ?? row.created_at),
      updated_at: String(doc.updated_at ?? row.updated_at),
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: dbErr } = await supabase
          .from("contests")
          .select("*")
          .in("status", ["published", "running", "ended"])
          .eq("document->>created_by", profile.id)
          .order("updated_at", { ascending: false });
        if (dbErr) throw new Error(dbErr.message);
        if (cancelled) return;
        const rows = (data ?? []) as Array<{
          id: string;
          status: string;
          created_at: string;
          updated_at: string;
          document: Record<string, unknown> | null;
        }>;
        setContests(rows.map(contestFromRow));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [profile.id, t]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-md" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {error}
      </div>
    );
  }

  if (contests.length === 0) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.contests.empty")}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {contests.map((contest) => {
        const title = contest.title?.trim() || t("userProfile.contests.fallbackTitle");
        const id = contest.id;
        const updatedAt = contest.updated_at;

        return (
          <NavLink
            key={id}
            to={`/contests/${id}/overview`}
            className="block rounded-md border border-border-subtle bg-card p-4 shadow-card transition hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">
                {title}
              </div>
              {updatedAt ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {t("userProfile.contests.updatedAt", {
                    date: new Date(updatedAt).toLocaleDateString(),
                  })}
                </div>
              ) : null}
            </div>
          </NavLink>
        );
      })}
    </div>
  );
}

