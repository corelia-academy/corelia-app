import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CalendarClock, Facebook, Globe2, Send, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Button } from "@/components/ui/button";
import { hackathonPreviewQueryOptions, publicHackathonDetailQueryOptions } from "@/features/hackathons/hackathonQueries";
import {
  getMyContestRegistration,
  getMyContestSubmission,
  registerForContest,
  canRegisterForContest,
  isPastContestSubmissionDeadline,
  sanitizeSlug,
} from "@/lib/hackathons";
import { canManageContests } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { Contest, ContestRegistration } from "@/types/hackathons";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { useDynamicPageTitle } from "@/components/navigation/PageTitle";
import { formatPrizeAmount } from "./utils/formatPrizeAmount";

const TABS = ["overview", "prizes", "timeline", "resources", "projects"] as const;

export type HackathonOutletContext = {
  contest: Contest;
  registration: ContestRegistration | null;
};

function formatDate(value: string, locale: string): string {
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
  const canonicalParamSlug = slug ? sanitizeSlug(slug) : null;
  const contest =
    loaded &&
    (loaded.slug === canonicalParamSlug || loaded.id === slug) &&
    (!previewRequested || previewAuthorized)
      ? loaded
      : null;
  useDynamicPageTitle(contest?.title);

  useEffect(() => {
    if (contest?.slug && slug && slug !== contest.slug) {
      const currentPath = location.pathname;
      const targetPath = currentPath.replace(`/hackathons/${slug}`, `/hackathons/${contest.slug}`);
      if (targetPath !== currentPath) {
        navigate(`${targetPath}${location.search}${location.hash}`, { replace: true });
      }
    }
  }, [contest?.slug, slug, location.pathname, location.search, location.hash, navigate]);

  const previewAccessPending = previewRequested && (!authInitialized || profileLoading);
  const registrationQuery = useQuery({
    queryKey: ["hackathons", contest?.id, "my-registration", user?.id ?? "anonymous"],
    queryFn: () => getMyContestRegistration(contest!.id, user),
    enabled: Boolean(contest && user && !previewRequested),
    staleTime: 30_000,
  });
  const submissionQuery = useQuery({ queryKey: ["projects", "my-submission", contest?.id, user?.id], queryFn: () => getMyContestSubmission(contest!.id, user), enabled: Boolean(contest && user && !previewRequested), staleTime: 0 });
  const registration = registrationQuery.data ?? null;
  const canRegister = Boolean(contest && canRegisterForContest(contest));
  const submissionClosed = Boolean(
    contest && isPastContestSubmissionDeadline(contest),
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
          <Button render={<NavLink to="/hackathons" />} nativeButton={false} variant="cta" hierarchy="secondary">{t("detail.errorState.backToList")}</Button>
        </div>
      </PageContainer>
    );
  }

  const cta = previewRequested ? null : registration ? (
    <Button
      type="button"
      className="min-h-11 w-full sm:w-auto"
      disabled={!submissionQuery.data?.project_id && submissionClosed}
      onClick={() => navigate(submissionQuery.data?.project_id ? `/projects/${submissionQuery.data.project_id}` : `/projects/new?hackathon=${encodeURIComponent(slug)}`)}
    >
      {submissionQuery.data?.project_id ? t("projects.editor.viewProject", { ns: "common" }) : submissionClosed ? t("public.submissionClosed") : t("public.createProject")}
    </Button>
  ) : (
    <Button
      type="button"
      className="min-h-11 w-full sm:w-auto"
      disabled={!canRegister || registerMutation.isPending}
      onClick={() => {
        if (!user) {
          navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`);
          return;
        }
        registerMutation.mutate();
      }}
    >
      {!canRegister ? t("public.registrationClosed") : t("public.register")}
    </Button>
  );
  const summary = contest.short_description || contest.tagline;

  return (
    <div className="pb-10">
      {previewAuthorized ? <div className="border-b border-warning/30 bg-warning-muted px-4 py-2 text-center text-sm font-medium text-foreground" role="status">{t("public.previewNotice")}</div> : null}
      <PageContainer width="default" className="pb-0">
        <header className="mobile-bleed-surface min-w-0 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
          {contest.cover_image_url ? (
            <div className="relative aspect-[21/9] w-full overflow-hidden bg-surface-raised">
              <img src={contest.cover_image_url} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="min-w-0 p-4 sm:p-6">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1">
                {!previewRequested ? <span data-hackathon-hero-status className="mb-2 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{t(`public.status.${contest.status}`)}</span> : null}
                <h1 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">{contest.title}</h1>
                {summary ? <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-foreground-muted sm:text-base">{summary}</p> : null}
                {summary ? <NavLink to={`/hackathons/${slug}/overview${previewRequested ? "?preview=1" : ""}#overview-content`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">{t("public.overview.readMore")}<ArrowUpRight className="size-4" aria-hidden /></NavLink> : null}
              </div>
              {cta || contest.social_links?.telegram || contest.social_links?.x || contest.social_links?.facebook ? (
                <div className="flex w-full flex-col gap-3 border-t border-border-subtle pt-4 sm:w-auto sm:flex-row sm:items-center lg:shrink-0 lg:border-0 lg:pt-0">
                  {cta}
                  <div className="flex items-center gap-2">
                    {contest.social_links?.telegram ? <Button render={<a href={contest.social_links.telegram} target="_blank" rel="noreferrer" aria-label="Telegram" />} nativeButton={false} size="small" variant="cta" hierarchy="secondary" iconOnly><Send className="size-4" /></Button> : null}
                    {contest.social_links?.x ? <Button render={<a href={contest.social_links.x} target="_blank" rel="noreferrer" aria-label="X" />} nativeButton={false} size="small" variant="cta" hierarchy="secondary" iconOnly><XLogo className="size-4" /></Button> : null}
                    {contest.social_links?.facebook ? <Button render={<a href={contest.social_links.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" />} nativeButton={false} size="small" variant="cta" hierarchy="secondary" iconOnly><Facebook className="size-4" /></Button> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className={cn("mobile-bleed-grid mt-3 grid gap-3", contest.prize_pool?.amount && Number(contest.prize_pool.amount) !== 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]")}>
          {contest.prize_pool?.amount && Number(contest.prize_pool.amount) !== 0 ? (
            <NavLink to={`/hackathons/${slug}/prizes${previewRequested ? "?preview=1" : ""}`} className="group flex min-w-0 flex-col items-start gap-2 rounded-xl border border-border-subtle bg-surface-base p-4 outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0"><div className="text-xs font-medium text-foreground-muted">{t("public.prizes.total")}</div><div className="mt-1 flex flex-wrap items-baseline gap-x-2"><span className="text-xl font-semibold tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere] sm:text-2xl">{formatPrizeAmount(contest.prize_pool.amount, locale)}</span><span className="text-sm text-foreground-muted">{contest.prize_pool.currency}</span></div></div>
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary group-hover:underline">{t("public.prizes.breakdown")}<ArrowUpRight className="size-4" aria-hidden /></span>
            </NavLink>
          ) : null}
          <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border-subtle bg-surface-base p-4 text-sm sm:grid-cols-4">
            {contest.host?.name ? <div className="col-span-2 flex min-w-0 items-center gap-2 sm:col-span-1">{contest.host.logo_url ? <img src={contest.host.logo_url} alt="" className="size-8 shrink-0 rounded-md bg-white object-contain p-0.5" /> : <Globe2 className="size-5 shrink-0 text-foreground-muted" aria-hidden />}<div className="min-w-0"><dt className="text-xs text-foreground-muted">{t("public.hostedBy")}</dt><dd className="truncate font-medium text-foreground">{contest.host.website_url ? <a href={contest.host.website_url} target="_blank" rel="noreferrer" className="hover:underline">{contest.host.name}</a> : contest.host.name}</dd></div></div> : null}
            <div className="min-w-0"><dt className="flex items-center gap-1 text-xs text-foreground-muted"><Users className="size-3.5" aria-hidden />{t("public.participants")}</dt><dd className="mt-1 font-medium text-foreground tabular-nums">{contest.participants_count ?? 0}</dd></div>
            {contest.registration_deadline ? <div className="min-w-0"><dt className="flex items-center gap-1 text-xs text-foreground-muted"><CalendarClock className="size-3.5 shrink-0" aria-hidden />{t("public.registrationDeadline")}</dt><dd className="mt-1 font-medium text-foreground"><time dateTime={contest.registration_deadline}>{formatDate(contest.registration_deadline, locale)}</time></dd></div> : null}
            {contest.submission_deadline ? <div className="min-w-0"><dt className="flex items-center gap-1 text-xs text-foreground-muted"><CalendarClock className="size-3.5 shrink-0" aria-hidden />{t("public.submissionDeadline")}</dt><dd className="mt-1 font-medium text-foreground"><time dateTime={contest.submission_deadline}>{formatDate(contest.submission_deadline, locale)}</time></dd></div> : null}
          </dl>
        </div>
      </PageContainer>

      <div className="sticky top-(--app-header-height) z-20 mt-4 border-y border-border-subtle bg-background/95 backdrop-blur">
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
