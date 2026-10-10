import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  FacebookLogo as PhosphorFacebookLogo,
  Globe,
  Info,
  ShareFat,
  TelegramLogo as PhosphorTelegramLogo,
  UsersThree,
  XLogo as PhosphorXLogo,
} from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { PageContainer } from "@/components/layouts/PagePrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { Timestamp } from "@/components/ui/timestamp";
import { TooltipPreview } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HackathonApplicantPreview } from "@/components/hackathons/HackathonApplicantPreview";
import { hackathonPreviewQueryOptions, publicHackathonApplicantPreviewsQueryOptions, publicHackathonDetailQueryOptions } from "@/features/hackathons/hackathonQueries";
import {
  getMyContestRegistration,
  getMyContestSubmission,
  registerForContest,
  getEffectiveContestSubmissionDeadline,
  canRegisterForContest,
  isPastContestSubmissionDeadline,
  sanitizeSlug,
} from "@/lib/hackathons";
import { canManageContests } from "@/lib/permissions";
import { useAuth } from "@/stores/authStore";
import type { Contest, ContestRegistration } from "@/types/hackathons";
import { ContestDetailLoadingCard } from "@/pages/hackathon-detail/components/ContestDetailGateStates";
import { useDynamicPageTitle } from "@/components/navigation/PageTitle";
import { formatPrizeAmount } from "./utils/formatPrizeAmount";
import { formatVietnamDateTime } from "./utils/formatVietnamDateTime";

const TABS = ["overview", "prizes", "timeline", "projects", "resources"] as const;

export type HackathonOutletContext = {
  contest: Contest;
  registration: ContestRegistration | null;
  submission: Awaited<ReturnType<typeof getMyContestSubmission>> | null;
  submissionLoading: boolean;
  submissionClosed: boolean;
};

function TelegramLogo({ className }: { className?: string }) {
  return <PhosphorTelegramLogo className={className} weight="duotone" aria-hidden />;
}

function XLogo({ className }: { className?: string }) {
  return <PhosphorXLogo className={className} weight="duotone" aria-hidden />;
}

function FacebookLogo({ className }: { className?: string }) {
  return <PhosphorFacebookLogo className={className} weight="duotone" aria-hidden />;
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
  const applicantsQuery = useQuery(publicHackathonApplicantPreviewsQueryOptions(contest && contest.status !== "draft" ? [contest.id] : []));
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
  const [nowMs] = useState(() => Date.now());
  const effectiveDeadline = contest
    ? getEffectiveContestSubmissionDeadline(contest)
    : null;
  const deadlineMs = effectiveDeadline ? Date.parse(effectiveDeadline) : Number.NaN;
  const remainingMs = Number.isFinite(deadlineMs) ? deadlineMs - nowMs : null;
  const closingSoon = Boolean(
    canRegister &&
      remainingMs !== null &&
      remainingMs > 0 &&
      remainingMs <= 24 * 60 * 60 * 1000,
  );
  const detailStatus = !canRegister
    ? "closed"
    : closingSoon
      ? "closingSoon"
      : "open";
  const deadlineCountdown = canRegister && remainingMs !== null && remainingMs > 0
    ? t("public.registrationCountdown", {
        time: t("detail.hero.countdownDays", {
          count: Math.ceil(remainingMs / (24 * 60 * 60 * 1000)),
        }),
      })
    : null;
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
  const tabRefs = useRef(new Map<(typeof TABS)[number], HTMLElement>());
  const activeTab = TABS.find((tab) => location.pathname.endsWith(`/${tab}`)) ?? "overview";
  const tabsListRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLSpanElement>(null);
  const indicatorInitializedRef = useRef(false);
  const revealTabHorizontally = useCallback((element: HTMLElement | null) => {
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

  useLayoutEffect(() => {
    const list = tabsListRef.current;
    const indicator = tabIndicatorRef.current;
    const activeElement = tabRefs.current.get(activeTab);

    if (!list || !indicator || !activeElement) return;

    const listRect = list.getBoundingClientRect();
    const tabRect = activeElement.getBoundingClientRect();
    const target = {
      x: tabRect.left - listRect.left,
      y: tabRect.top - listRect.top,
      width: tabRect.width,
      height: tabRect.height,
    };

    if (
      !indicatorInitializedRef.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      gsap.set(indicator, target);
      indicatorInitializedRef.current = true;
      return;
    }

    const currentRect = indicator.getBoundingClientRect();
    gsap.set(indicator, {
      width: target.width,
      height: target.height,
      transformOrigin: "left top",
      x: currentRect.left - listRect.left,
      y: currentRect.top - listRect.top,
      scaleX: currentRect.width / target.width,
      scaleY: currentRect.height / target.height,
    });

    const tween = gsap.to(indicator, {
      x: target.x,
      y: target.y,
      scaleX: 1,
      scaleY: 1,
      duration: 0.28,
      ease: "power2.out",
      overwrite: "auto",
    });

    return () => {
      tween.kill();
    };
  }, [activeTab, contest?.id]);

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
      size="small"
      className="min-h-11 w-full sm:w-auto lg:min-h-0"
      data-hackathon-control
      disabled
    >
      {t("public.detailStatus.registered")}
    </Button>
  ) : !canRegister ? null : (
    <Button
      type="button"
      size="small"
      className="min-h-11 w-full sm:w-auto lg:min-h-0"
      data-hackathon-control
      disabled={registerMutation.isPending}
      onClick={() => {
        if (!user) {
          navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)}`);
          return;
        }
        registerMutation.mutate();
      }}
    >
      {t("public.register")}
    </Button>
  );
  const summary = contest.short_description || contest.tagline;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const participantCount = contest.participants_count ?? 0;
  const displayParticipantCount = new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(participantCount);

  return (
    <div className="pb-10">
      {previewAuthorized ? <div className="border-b border-warning/30 bg-warning-muted px-4 py-2 text-center text-sm font-medium text-foreground" role="status">{t("public.previewNotice")}</div> : null}
      <PageContainer width="default" className="px-0 pb-0 pt-0 sm:px-6 sm:pt-5 lg:px-8 lg:pt-12 lg:pb-0">
        <NavLink
          to="/hackathons"
          className="mb-4xl inline-flex min-h-8 items-center gap-1 text-xs font-medium text-foreground hover:text-foreground-muted focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowLeft className="size-3" weight="duotone" aria-hidden />
          {t("detail.errorState.backToList")}
        </NavLink>
        <header className="mobile-bleed-surface min-w-0">
          {contest.cover_image_url ? (
            <div className="aspect-[21/9] w-full overflow-hidden rounded-xl bg-surface-raised">
              <img src={contest.cover_image_url} alt="" className="block h-full w-full rounded-xl object-cover" fetchPriority="high" />
            </div>
          ) : null}

          <div className="min-w-0 pt-6">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:gap-x-4">
                  <h1 data-hackathon-title className="max-w-4xl text-[28px] font-display font-medium leading-[1.2] text-foreground [overflow-wrap:anywhere]">{contest.title}</h1>
                  {!previewRequested ? <Badge data-hackathon-hero-status size="small" color={detailStatus === "open" ? "success" : detailStatus === "closingSoon" ? "warning" : "gray"} className="h-auto leading-[1.4]">{t(`public.detailStatus.${detailStatus}`)}</Badge> : null}
                </div>
                <div className="mt-3 flex min-w-0 flex-col gap-3 lg:mt-4 lg:flex-row lg:items-center lg:justify-between">
                  {summary ? <p className="max-w-[640px] text-sm leading-[1.4] tracking-[0.32px] text-foreground-subtle lg:text-base">{summary}</p> : <span />}
                </div>
                <Timestamp
                  type="full"
                  size="large"
                  className="mt-4 w-full flex-wrap gap-3 whitespace-normal lg:mt-8 [&>[data-slot=separator]]:hidden sm:[&>[data-slot=separator]]:block"
                  date={(
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-3 text-foreground-subtle">
                      <Badge size="small" color="white" variant="outline" className="h-auto leading-[1.4]">
                        {t(`public.mode.${contest.mode ?? contest.location}`)}
                      </Badge>
                      {contest.host?.name ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          {contest.host.logo_url ? (
                            <img src={contest.host.logo_url} alt="" className="size-6 shrink-0 rounded-full bg-white object-contain p-0.5" />
                          ) : (
                            <Globe className="size-4 shrink-0" weight="duotone" aria-hidden />
                          )}
                          <span className="truncate">
                            {contest.host.website_url
                              ? <a href={contest.host.website_url} target="_blank" rel="noreferrer" className="hover:underline">{t("catalog.hostedBy", { name: contest.host.name })}</a>
                              : t("catalog.hostedBy", { name: contest.host.name })}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  )}
                  time={(
                    <HackathonApplicantPreview
                      applicants={applicantsQuery.data?.[contest.id]}
                      count={participantCount}
                      summary={t("catalog.participantsCount", { displayCount: displayParticipantCount })}
                      label={t("public.applications")}
                      emptyIcon={<UsersThree className="size-5 text-foreground-muted" weight="duotone" aria-hidden />}
                    />
                  )}
                />
              </div>
              <Separator className="lg:hidden" />
              <div className="flex w-full flex-col items-end gap-3 sm:w-auto lg:shrink-0">
                <div className="flex w-full items-center justify-end gap-4 sm:w-auto">
                  {cta}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="medium"
                          variant="cta"
                          hierarchy="tertiary"
                          iconOnly
                          aria-label={t("detail.hero.share")}
                          data-hackathon-share
                          className="rounded-full"
                        >
                          <ShareFat className="size-4" weight="duotone" aria-hidden />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-[200px]">
                      <DropdownMenuItem onClick={() => {
                        void navigator.clipboard.writeText(shareUrl).then(
                          () => toast.success(t("detail.hero.shareCopied")),
                          () => toast.error(t("detail.hero.shareCopyFailed")),
                        );
                      }}>{t("detail.hero.shareCopyLink")}</DropdownMenuItem>
                      {contest.social_links?.telegram ? <DropdownMenuItem onClick={() => window.open(contest.social_links!.telegram!, "_blank", "noopener,noreferrer")}><TelegramLogo className="mr-2 size-4" />Telegram</DropdownMenuItem> : null}
                      {contest.social_links?.x ? <DropdownMenuItem onClick={() => window.open(contest.social_links!.x!, "_blank", "noopener,noreferrer")}><XLogo className="mr-2 size-4" />X</DropdownMenuItem> : null}
                      {contest.social_links?.facebook ? <DropdownMenuItem onClick={() => window.open(contest.social_links!.facebook!, "_blank", "noopener,noreferrer")}><FacebookLogo className="mr-2 size-4" />Facebook</DropdownMenuItem> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {deadlineCountdown ? (
                  <p
                    className={`inline-flex shrink-0 items-center gap-2 font-body text-xs leading-[1.25] tracking-[0.24px] ${
                      detailStatus === "closingSoon" ? "text-warning-300" : "text-foreground"
                    }`}
                  >
                    <Clock className="size-5" weight="duotone" aria-hidden />
                    {deadlineCountdown}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <div data-hackathon-metadata className="mobile-bleed-grid mt-8 grid min-w-0 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0 lg:gap-x-8">
          <NavLink to={`/hackathons/${slug}/prizes${previewRequested ? "?preview=1" : ""}`} className="group min-w-0 px-4 py-4 outline-none transition-colors hover:bg-surface-base focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/40 sm:px-0 lg:py-0">
            <div className="font-display text-lg font-medium leading-[1.2] text-blue-400">{t("public.prizes.total")}</div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2"><span className="font-display text-[28px] font-medium leading-[1.2] tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere]">{contest.prize_pool?.amount ? formatPrizeAmount(contest.prize_pool.amount, locale) : "—"}</span>{contest.prize_pool?.currency ? <span className="text-sm text-foreground-muted lg:font-display lg:text-[28px] lg:font-medium lg:leading-[1.2]">{contest.prize_pool.currency}</span> : null}</div>
          </NavLink>
          <Separator className="sm:hidden" />
          <Separator orientation="vertical" className="hidden sm:block" />
          <div className="min-w-0 px-4 py-4 sm:px-0 lg:py-0">
            <div className="flex items-center gap-2 font-display text-lg font-medium leading-[1.2] text-blue-400">
              {t("public.registrationDeadline")}
              <span className="relative h-5 w-6 shrink-0">
                <TooltipPreview
                  arrow="none"
                  side="bottom"
                  trigger={<Info className="size-3.5 shrink-0" weight="duotone" aria-hidden />}
                  triggerLabel={t("public.registrationDeadline")}
                  triggerClassName="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 [@media(pointer:coarse)]:size-11"
                >
                  {t("public.timezoneLabel")}
                </TooltipPreview>
              </span>
            </div>
            <div className="mt-2 font-display text-[28px] font-medium leading-[1.2] text-foreground">{effectiveDeadline ? <time dateTime={effectiveDeadline}>{formatVietnamDateTime(effectiveDeadline, locale, { includeTimezone: false, compact: true })}</time> : "—"}</div>
          </div>
          <Separator className="sm:hidden" />
          <Separator orientation="vertical" className="hidden sm:block" />
          <div className="min-w-0 px-4 py-4 sm:px-0 lg:py-0">
            <div className="flex items-center gap-2 font-display text-lg font-medium leading-[1.2] text-blue-400">
              {t("public.submissionDeadline")}
              <span className="relative h-5 w-6 shrink-0">
                <TooltipPreview
                  arrow="none"
                  side="bottom"
                  trigger={<Info className="size-3.5 shrink-0" weight="duotone" aria-hidden />}
                  triggerLabel={t("public.submissionDeadline")}
                  triggerClassName="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 [@media(pointer:coarse)]:size-11"
                >
                  {t("public.timezoneLabel")}
                </TooltipPreview>
              </span>
            </div>
            <div className="mt-2 font-display text-[28px] font-medium leading-[1.2] text-foreground">{effectiveDeadline ? <time dateTime={effectiveDeadline}>{formatVietnamDateTime(effectiveDeadline, locale, { includeTimezone: false, compact: true })}</time> : "—"}</div>
          </div>
        </div>
      </PageContainer>

      <Tabs.Root
        value={activeTab}
        onValueChange={(value) => {
          const nextTab = TABS.find((candidate) => candidate === value);
          if (nextTab) {
            navigate(`/hackathons/${slug}/${nextTab}${previewRequested ? "?preview=1" : ""}`);
          }
        }}
      >
  <div className="mobile-bleed-surface sticky top-[calc(var(--app-header-height)_+_0.5rem)] z-30 mt-6 bg-background lg:top-0 lg:mt-8 lg:pt-0 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-10 after:bg-linear-to-b after:from-background/90 after:via-background/30 after:to-transparent after:content-['']">
          <div ref={tabsScrollerRef} className="overflow-x-auto overscroll-x-contain scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PageContainer width="default" className="py-0">
              <Tabs.List ref={tabsListRef} level="3a" className="relative min-w-max gap-2 py-1 lg:py-0" aria-label={t("public.tabsLabel")}>
                <Tabs.Indicator
                  ref={tabIndicatorRef}
                  className="pointer-events-none absolute left-0 top-0 z-0 rounded-full border border-tabs-border-active"
                />
                {TABS.map((tab) => (
                  <Tabs.Tab
                    key={tab}
                    value={tab}
                    ref={(node) => { if (node) tabRefs.current.set(tab, node); else tabRefs.current.delete(tab); }}
                    className="relative z-10 data-[active]:ring-transparent"
                    onFocus={(event) => {
                      const scrollY = window.scrollY;
                      event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
                      if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY });
                    }}
                  >
                    {t(`public.tabs.${tab}`)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </PageContainer>
          </div>
        </div>

        <PageContainer width="default" className="px-0 pt-3xl sm:px-6 sm:pt-3xl lg:px-8">
          <Tabs.Panel value={activeTab} className="mobile-bleed-grid">
            <Outlet context={{ contest, registration, submission: submissionQuery.data ?? null, submissionLoading: Boolean(user && !previewRequested && submissionQuery.isPending), submissionClosed } satisfies HackathonOutletContext} />
          </Tabs.Panel>
        </PageContainer>
      </Tabs.Root>
    </div>
  );
}
