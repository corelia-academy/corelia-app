import { useEffect, useState } from "react";
import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import type { PublicProfile } from "@/types/database";
import type { Contest } from "@/types/hackathons";

import { contestFromRow } from "../utils/contestFromRow";

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
        const [{ data, error: dbErr }, participationResult] = await Promise.all([
          supabase
            .from("contests")
            .select("*")
            .in("status", ["published", "running", "ended"])
            .eq("document->>created_by", profile.id)
            .order("updated_at", { ascending: false }),
          isSelf
            ? supabase
                .from("contest_submissions")
                .select("contest_id")
                .eq("user_id", profile.id)
            : Promise.resolve({ data: null as Array<{ contest_id: string }> | null, error: null }),
        ]);

        if (dbErr) throw new Error(dbErr.message);
        if (participationResult.error) throw new Error(participationResult.error.message);
        if (cancelled) return;

        const rows = ((data ?? []) as Array<{
          id: string;
          status: string;
          created_at: string;
          updated_at: string;
          document: Record<string, unknown> | null;
        }>).map((row) => contestFromRow(row, profile.id));
        setContests(rows);

        const contestIds = Array.from(
          new Set((participationResult.data ?? []).map((r) => r.contest_id)),
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
        if (pErr) throw new Error(pErr.message);
        if (cancelled) return;

        const pRows = (pData ?? []) as Array<{
          id: string;
          status: string;
          created_at: string;
          updated_at: string;
          document: Record<string, unknown> | null;
        }>;
        setParticipations(pRows.map((row) => contestFromRow(row, profile.id)));
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : t("userProfile.errors.loadFailed"),
        );
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

  if (contests.length === 0 && (!isSelf || participations.length === 0)) {
    return (
      <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
        {t("userProfile.contests.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 text-sm font-semibold text-foreground">
          {t("userProfile.contests.organizedTitle")}
        </div>
        {contests.length === 0 ? (
          <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
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
        )}
      </div>

      {isSelf ? (
        <div>
          <div className="mb-3 text-sm font-semibold text-foreground">
            {t("userProfile.contests.participatedTitle")}
          </div>
          {participations.length === 0 ? (
            <div className="rounded-md border border-border-subtle bg-card p-4 text-sm text-muted-foreground shadow-card sm:p-6">
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
          )}
        </div>
      ) : null}
    </div>
  );
}
