import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Facebook, Globe2, MapPin, Send, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Button } from "@/components/ui/button";
import { hackathonPreviewQueryOptions, publicHackathonDetailQueryOptions } from "@/features/hackathons/hackathonQueries";
import { getMyContestRegistration, registerForContest } from "@/lib/hackathons";
import { canManageContests } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { Contest, ContestRegistration } from "@/types/hackathons";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";

const TABS = ["overview", "prizes", "timeline", "resources", "projects"] as const;

export type HackathonOutletContext = {
  contest: Contest;
  registration: ContestRegistration | null;
};

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      data-social-icon="x"
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"
      />
    </svg>
  );
}

export default function ContestPublicLayout() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation("contests");
  const { user, profile, profileLoading, authInitialized } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const previewRequested = new URLSearchParams(location.search).get("preview") === "1";
  const previewAuthorized = previewRequested && canManageContests(profile);
  const options = publicHackathonDetailQueryOptions(slug, locale, !previewRequested);
  const publicContestQuery = useQuery(options);
  const previewOptions = hackathonPreviewQueryOptions(slug, locale, user?.id, previewAuthorized);
  const previewContestQuery = useQuery(previewOptions);
  const contestQuery = previewRequested ? previewContestQuery : publicContestQuery;
  const loaded = contestQuery.data;
  const contest = loaded && loaded.slug === slug && (!previewRequested || previewAuthorized) ? loaded : null;
  const previewAccessPending = previewRequested && (!authInitialized || profileLoading);
  const registrationQuery = useQuery({
    queryKey: ["hackathons", contest?.id, "my-registration", user?.id ?? "anonymous"],
    queryFn: () => getMyContestRegistration(contest!.id, user),
    enabled: Boolean(contest && user && !previewRequested),
    staleTime: 30_000,
  });
  const registration = registrationQuery.data ?? null;
  const [renderedAt] = useState(() => Date.now());
  const registrationClosed = Boolean(
    contest?.registration_deadline && renderedAt > new Date(contest.registration_deadline).getTime(),
  );
  const submissionClosed = Boolean(
    contest?.submission_deadline && renderedAt > new Date(contest.submission_deadline).getTime(),
  );
  const registerMutation = useMutation({
    mutationFn: () => registerForContest(contest!.id, {}),
    onSuccess: async () => {
      toast.success(t("public.registered"));
      await Promise.all([
        registrationQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("public.registerFailed")),
  });
  const translate = useCallback(
    (key: string, values?: Record<string, unknown>) => String(t(key as never, values as never)),
    [t],
  );

  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<(typeof TABS)[number], HTMLAnchorElement>());
  const activeTab = TABS.find((tab) => location.pathname.endsWith(`/${tab}`)) ?? "overview";
  const revealTabHorizontally = useCallback((element: HTMLAnchorElement | null) => {
    const scroller = tabsScrollerRef.current;
    if (!scroller || !element) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    if (elementRect.left < scrollerRect.left) {
      scroller.scrollTo({ left: scroller.scrollLeft - (scrollerRect.left - elementRect.left), behavior: "smooth" });
    } else if (elementRect.right > scrollerRect.right) {
      scroller.scrollTo({ left: scroller.scrollLeft + (elementRect.right - scrollerRect.right), behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => revealTabHorizontally(tabRefs.current.get(activeTab) ?? null));
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, contest?.id, revealTabHorizontally]);

  if (previewAccessPending || (!previewRequested && publicContestQuery.isPending) || (previewAuthorized && previewContestQuery.isPending)) return <ContestDetailLoadingCard translate={translate} />;
  if (contestQuery.error || !contest || !slug) {
    return (
      <PageContainer width="default">
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
          <p className="text-sm font-medium text-foreground">{contestQuery.error ? t("detail.errors.loadFailed") : t("detail.errors.notFound")}</p>
          <Button render={<NavLink to="/hackathons" />} nativeButton={false} variant="outline">{t("detail.errorState.backToList")}</Button>
        </div>
      </PageContainer>
    );
  }

  const cta = previewRequested ? null : registration ? (
    <Button
      type="button"
      disabled={submissionClosed}
      onClick={() => navigate(`/projects/new?hackathon=${encodeURIComponent(slug)}`)}
    >
      {submissionClosed ? t("public.submissionClosed") : t("public.createProject")}
    </Button>
  ) : (
    <Button
      type="button"
      disabled={registrationClosed || registerMutation.isPending}
      onClick={() => {
        if (!user) {
          navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
          return;
        }
        registerMutation.mutate();
      }}
    >
      {registrationClosed ? t("public.registrationClosed") : t("public.register")}
    </Button>
  );

  return (
    <div className="pb-10">
      {previewAuthorized ? <div className="border-b border-warning/30 bg-warning-muted px-4 py-2 text-center text-sm font-medium text-foreground" role="status">{t("public.previewNotice")}</div> : null}
      <PageContainer width="default" className="pb-0">
        <header className="min-w-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
          {contest.cover_image_url ? (
            <div className="relative aspect-[21/9] w-full overflow-hidden bg-surface-raised">
              <img src={contest.cover_image_url} alt="" className="h-full w-full object-cover" />
              {!previewRequested ? (
                <span
                  data-hackathon-hero-status
                  className="absolute bottom-4 left-4 rounded-full border border-border bg-background/90 px-3 py-1 text-xs font-medium uppercase tracking-wide text-foreground shadow-sm backdrop-blur-sm sm:bottom-5 sm:left-5"
                >
                  {t(`public.status.${contest.status}`)}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="min-w-0 border-b border-border-subtle p-5 sm:p-6">
            {!previewRequested && !contest.cover_image_url ? (
              <div className="mb-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                <span className="rounded-full bg-surface-raised px-3 py-1">{t(`public.status.${contest.status}`)}</span>
              </div>
            ) : null}
            <h1 className="min-w-0 max-w-4xl break-words text-2xl font-bold text-foreground [overflow-wrap:anywhere] sm:text-4xl">{contest.title}</h1>
            {contest.short_description || contest.tagline ? (
              <p className="mt-2 max-w-3xl text-sm text-foreground-muted sm:text-base">{contest.short_description || contest.tagline}</p>
            ) : null}
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center sm:p-6">
            <div className="grid gap-3 text-sm text-foreground-muted sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-w-0 items-center gap-2">
                {contest.host?.logo_url ? <img src={contest.host.logo_url} alt="" className="size-8 rounded-md bg-white object-contain p-0.5" /> : <Globe2 className="size-5" aria-hidden />}
                <div className="min-w-0"><div className="text-xs">{t("public.hostedBy")}</div>{contest.host?.website_url ? <a href={contest.host.website_url} target="_blank" rel="noreferrer" className="truncate font-medium text-foreground hover:underline">{contest.host.name || "—"}</a> : <div className="truncate font-medium text-foreground">{contest.host?.name || "—"}</div>}</div>
              </div>
              <div className="flex items-center gap-2"><Users className="size-5" aria-hidden /><div><div className="text-xs">{t("public.participants")}</div><div className="font-medium text-foreground">{contest.participants_count ?? 0}</div></div></div>
              <div className="flex items-center gap-2"><CalendarClock className="size-5" aria-hidden /><div><div className="text-xs">{t("public.registrationDeadline")}</div><div className="font-medium text-foreground">{formatDate(contest.registration_deadline, locale)}</div></div></div>
              <div className="flex items-center gap-2"><MapPin className="size-5" aria-hidden /><div><div className="text-xs">{t("public.submissionDeadline")}</div><div className="font-medium text-foreground">{formatDate(contest.submission_deadline, locale)}</div></div></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {contest.social_links?.telegram ? <Button render={<a href={contest.social_links.telegram} target="_blank" rel="noreferrer" aria-label="Telegram" />} nativeButton={false} size="icon" variant="outline"><Send className="size-4" /></Button> : null}
              {contest.social_links?.x ? <Button render={<a href={contest.social_links.x} target="_blank" rel="noreferrer" aria-label="X" />} nativeButton={false} size="icon" variant="outline"><XLogo className="size-4" /></Button> : null}
              {contest.social_links?.facebook ? <Button render={<a href={contest.social_links.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" />} nativeButton={false} size="icon" variant="outline"><Facebook className="size-4" /></Button> : null}
              {cta}
            </div>
          </div>
        </header>
      </PageContainer>

      <div className="sticky top-11 z-20 mt-4 border-y border-border-subtle bg-background/95 backdrop-blur">
        <div ref={tabsScrollerRef} className="overflow-x-auto overscroll-x-contain scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PageContainer width="default" className="py-0">
            <nav className="flex min-w-max" aria-label={t("public.tabsLabel")}>
              {TABS.map((tab) => (
                <NavLink
                  key={tab}
                  ref={(node) => { if (node) tabRefs.current.set(tab, node); else tabRefs.current.delete(tab); }}
                  to={`/hackathons/${slug}/${tab}${previewRequested ? "?preview=1" : ""}`}
                  onFocus={(event) => {
                    const scrollY = window.scrollY;
                    event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                    if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY });
                  }}
                  className={({ isActive }) => cn("flex min-h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40", isActive ? "border-primary text-primary" : "border-transparent text-foreground-muted hover:text-foreground")}
                >
                  {t(`public.tabs.${tab}`)}
                </NavLink>
              ))}
            </nav>
          </PageContainer>
        </div>
      </div>

      <PageContainer width="default" className="pt-6">
        <Outlet context={{ contest, registration } satisfies HackathonOutletContext} />
      </PageContainer>
    </div>
  );
}
