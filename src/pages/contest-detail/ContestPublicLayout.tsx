import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layouts/PagePrimitives";
import { getContest } from "@/lib/contests";
import { contestListImageUrl } from "@/lib/contestVisuals";
import type { Contest } from "@/types/contests";
import { useTranslation } from "react-i18next";
import { ContestPublicNav } from "@/pages/contest-detail/ContestPublicNav";

const PUBLIC_STATUSES: Contest["status"][] = ["published", "running", "ended"];

export default function ContestPublicLayout() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation("contests");
  const translate = useCallback(
    (key: string, options?: Record<string, unknown>) => String(t(key as never, options as never)),
    [t],
  );
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await getContest(id);
        if (cancelled) return;
        if (!data || !PUBLIC_STATUSES.includes(data.status)) {
          setContest(null);
          setError(translate("detail.errors.notFound"));
          return;
        }
        setContest(data);
      } catch {
        if (!cancelled) setError(translate("detail.errors.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, translate]);

  if (loading) {
    return (
      <PageContainer>
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-16 text-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{translate("detail.loading.title")}</p>
        </div>
      </PageContainer>
    );
  }

  if (error || !contest || !id) {
    return (
      <PageContainer>
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm font-medium text-foreground">{error ?? translate("detail.errors.notFound")}</p>
          <Button render={<NavLink to="/contests" />} nativeButton={false} variant="outline">
            {translate("detail.errorState.backToList")}
          </Button>
        </div>
      </PageContainer>
    );
  }

  const listThumbUrl = contestListImageUrl(contest);

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-border-subtle bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <PageContainer className="py-3 sm:py-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              render={<NavLink to="/contests" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="-ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {translate("detail.hero.backToContests")}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {listThumbUrl ? (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border-subtle bg-muted shadow-sm">
                <img
                  src={listThumbUrl}
                  alt={translate("detail.visual.listThumbAlt", { title: contest.title })}
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div
                className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-primary/10 text-primary shadow-sm"
                aria-hidden
              >
                <Trophy className="size-7" />
              </div>
            )}
            <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {contest.title}
            </h1>
          </div>
          <ContestPublicNav contestId={id} contest={contest} />
        </PageContainer>
      </div>
      <Outlet context={{ contest, setContest }} />
    </>
  );
}
