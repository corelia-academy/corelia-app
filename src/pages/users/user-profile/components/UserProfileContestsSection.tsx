import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import type { PublicProfile } from "@/types/database";
import type { Contest } from "@/types/hackathons";

import { contestFromRow } from "../utils/contestFromRow";

function isMissingRelationError(error: unknown): boolean {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  return (
    code === "PGRST205" ||
    (message.includes("schema cache") &&
      (message.includes("public.contests") ||
        message.includes("public.contest_submissions")))
  );
}

export function UserProfileContestsSection({
  profile,
  isSelf,
}: {
  profile: PublicProfile;
  isSelf: boolean;
}) {
  const { t } = useTranslation("common");
  const [contests, setContests] = useState<Contest[]>([]);
  const [participations, setParticipations] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        if (dbErr) {
          if (isMissingRelationError(dbErr)) {
            if (!cancelled) {
              setContests([]);
              setParticipations([]);
            }
            return;
          }
          throw dbErr;
        }
        if (cancelled) return;

        const rows = ((data ?? []) as Array<{
          id: string;
          status: string;
          created_at: string;
          updated_at: string;
          document: Record<string, unknown> | null;
        }>).map((row) => contestFromRow(row, profile.id));
        setContests(rows);

        if (!isSelf) {
          setParticipations([]);
          return;
        }

        const { data: participationData, error: participationErr } = await supabase
          .from("contest_submissions")
          .select("contest_id")
          .eq("user_id", profile.id);

        if (participationErr) {
          if (isMissingRelationError(participationErr)) {
            setParticipations([]);
            return;
          }
          throw participationErr;
        }
        if (cancelled) return;

        const contestIds = Array.from(
          new Set((participationData ?? []).map((r) => r.contest_id)),
        ).filter(Boolean);
        if (contestIds.length === 0) {
          setParticipations([]);
          return;
        }

        const { data: pData, error: pErr } = await supabase
          .from("contests")
          .select("*")
          .in("id", contestIds)
          .in("status", ["published", "running", "ended"])
          .order("updated_at", { ascending: false });
        if (pErr) {
          if (isMissingRelationError(pErr)) {
            setParticipations([]);
            return;
          }
          throw pErr;
        }
        if (cancelled) return;

        const pRows = (pData ?? []) as Array<{
          id: string;
          status: string;
          created_at: string;
          updated_at: string;
          document: Record<string, unknown> | null;
        }>;
        setParticipations(pRows.map((row) => contestFromRow(row, profile.id)));
      } catch {
        if (cancelled) return;
        setError(t("userProfile.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSelf, profile.id, t]);

  if (loading) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-base p-4 text-sm text-foreground-muted shadow-card sm:p-6">
          {error}
        </div>
      </section>
    );
  }

  if (contests.length === 0 && (!isSelf || participations.length === 0)) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-base p-6 text-sm text-foreground-muted shadow-card">
          {t("userProfile.contests.empty")}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-foreground-muted" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">
            {t("userProfile.tabs.contests")}
          </h2>
        </div>
        <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium tabular-nums text-foreground-muted">
          {contests.length + (isSelf ? participations.length : 0)}
        </span>
      </div>

      <div>
        <div className="mb-3 text-sm font-semibold text-foreground">
          {t("userProfile.contests.organizedTitle")}
        </div>
        {contests.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted sm:p-6">
            {t("userProfile.contests.empty")}
          </div>
        ) : (
          <div className="grid gap-3">
            {contests.map((contest) => {
              const title =
                contest.title?.trim() || t("userProfile.contests.fallbackTitle");
              const id = contest.id;
              const updatedAt = contest.updated_at;

              return (
                <NavLink
                  key={id}
                  to={`/hackathons/${id}/overview`}
                  className="block rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card transition-[background-color,border-color] duration-150 hover:border-border hover:bg-surface-raised"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {title}
                    </div>
                    {updatedAt ? (
                      <div className="mt-1 text-xs text-foreground-muted">
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
        )}
      </div>

      {isSelf ? (
        <div>
          <div className="mb-3 text-sm font-semibold text-foreground">
            {t("userProfile.contests.participatedTitle")}
          </div>
          {participations.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 text-sm text-foreground-muted sm:p-6">
              {t("userProfile.contests.participatedEmpty")}
            </div>
          ) : (
            <div className="grid gap-3">
              {participations.map((contest) => {
                const title =
                  contest.title?.trim() ||
                  t("userProfile.contests.fallbackTitle");
                const id = contest.id;
                const updatedAt = contest.updated_at;

                return (
                  <NavLink
                    key={`p-${id}`}
                    to={`/hackathons/${id}/overview`}
                    className="block rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card transition-[background-color,border-color] duration-150 hover:border-border hover:bg-surface-raised"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {title}
                      </div>
                      {updatedAt ? (
                        <div className="mt-1 text-xs text-foreground-muted">
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
          )}
        </div>
      ) : null}
    </section>
  );
}
