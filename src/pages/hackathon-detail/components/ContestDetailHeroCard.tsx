import { Settings, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContestDetailScheduleMetaStrip } from "@/pages/hackathon-detail/components/ContestDetailScheduleMetaStrip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import {
  deriveHackathonLifecycle,
  hackathonLifecycleBadgeClassName,
  hackathonLifecycleShowsPulseDot,
} from "@/pages/hackathon-detail/utils/contestLifecycle";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

function ContestHeroVisual({
  contest,
  translate,
}: {
  contest: Contest;
  translate: (key: string, options?: Record<string, unknown>) => string;
}) {
  const src =
    contest.cover_image_url?.trim() || contest.thumbnail_url?.trim() || null;

  if (src) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
        <img
          src={src}
          alt={translate("detail.visual.bannerAlt", {
            title: contest.title,
          })}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="aspect-square w-full rounded-xl border border-border-subtle bg-linear-to-br from-primary/30 via-primary/10 to-surface-raised"
      aria-hidden
    />
  );
}

export function ContestDetailHeroCard({
  vm,
  titleAs = "h1",
}: {
  vm: ContestDetailViewModel;
  titleAs?: "h1" | "h2";
}) {
  const { contest } = vm;
  const {
    translate,
    navigate,
    isManageView,
    activeManageSectionMeta,
    lifecycleBadgeLabel,
    hackathonLifecycle,
    publicHeroHighlights,
    publicHeroCountdown,
    formatDateTime,
    locationLabel,
    isManager,
    canJudge,
    viewerRoles,
    canAccessWorkspace,
    publicCta,
    activeManageSection,
  } = vm;

  const TitleTag = titleAs;

  const lifecycleForBadge =
    hackathonLifecycle ?? deriveHackathonLifecycle(contest);
  const badgeClass = hackathonLifecycleBadgeClassName(lifecycleForBadge);
  const showPulseDot = hackathonLifecycleShowsPulseDot(lifecycleForBadge);

  const implausibleStart =
    contest.starts_at &&
    contest.created_at &&
    new Date(contest.starts_at).getTime() <
      new Date(contest.created_at).getTime();

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareEncoded = encodeURIComponent(shareUrl);
  const titleEncoded = encodeURIComponent(contest.title);

  const openShare = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isManageView) {
    const manageOverviewLayout = activeManageSection === "overview";

    return (
      <Card
        className={cn(
          "overflow-hidden border-primary/25 shadow-sm ring-1 ring-primary/15 ring-inset",
        )}
      >
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
            <div className="order-2 flex flex-col gap-5 lg:order-1 lg:col-span-7">
              <div
                className="rounded-xl border border-primary/30 bg-linear-to-br from-primary/14 via-primary/6 to-transparent px-3 py-3 sm:px-4 sm:py-3.5"
                role="status"
                aria-label={translate("workspace.manage.heroSurfaceAria")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Settings
                    className="size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {translate("workspace.manage.heroSurfaceBadge")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground-muted sm:text-[13px]">
                  {translate("workspace.manage.heroSurfaceHint")}
                </p>
              </div>

              <header className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.heroEyebrow")}
                </div>
                <TitleTag className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {contest.title}
                </TitleTag>
                {contest.tagline?.trim() ? (
                  <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">
                    {contest.tagline}
                  </p>
                ) : null}
              </header>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                    badgeClass,
                  )}
                >
                  {showPulseDot ? (
                    <span className="relative flex size-2 shrink-0">
                      <span
                        className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-35"
                        aria-hidden
                      />
                      <span
                        className="relative inline-flex size-2 rounded-full bg-current"
                        aria-hidden
                      />
                    </span>
                  ) : null}
                  {lifecycleBadgeLabel}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-9"
                  onClick={() =>
                    navigate(
                      contest.slug?.trim()
                        ? `/hackathons/${contest.slug.trim()}`
                        : "/hackathons",
                    )
                  }
                >
                  {translate("workspace.manage.viewPublicPage")}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-foreground-muted">
                  {vm.statusLabel(contest.status)}
                </span>
                <span
                  className={cn(
                    "rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary",
                  )}
                >
                  {activeManageSectionMeta.label}
                </span>
              </div>

              <p className="max-w-3xl text-sm leading-relaxed text-foreground-muted">
                {activeManageSectionMeta.description}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {isManager ? (
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                    {translate("workspace.manage.roleCoreliaOps")}
                  </span>
                ) : null}
                {canJudge ? (
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                    {translate("workspace.manage.roleJudgePanel")}
                  </span>
                ) : null}
                {viewerRoles.includes("co_host_viewer") ? (
                  <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                    {translate("workspace.manage.roleCoHostObserver")}
                  </span>
                ) : null}
              </div>

              {implausibleStart && canAccessWorkspace ? (
                <p className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
                  {translate("detail.hero.implausibleStartWarning")}
                </p>
              ) : null}
            </div>

            <div className="order-1 lg:order-2 lg:col-span-5 lg:col-start-8 lg:row-start-1">
              <ContestHeroVisual contest={contest} translate={translate} />
            </div>
          </div>

          <ContestDetailScheduleMetaStrip
            className="mt-6 border-t border-border-subtle pt-6 sm:mt-8 sm:pt-8"
            contest={contest}
            translate={translate}
            formatDateTime={formatDateTime}
            locationLabel={locationLabel}
            labelsMode="manage"
          />

          {manageOverviewLayout ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.overviewApplications")}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {Number(contest.metrics_snapshot.registrations_total ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.overviewApproved")}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {Number(contest.metrics_snapshot.approved_registrations ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.overviewSubmissions")}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {Number(contest.metrics_snapshot.submissions_total ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-base p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("workspace.manage.overviewScored")}
                </div>
                <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {Number(contest.metrics_snapshot.scored_submissions ?? 0)}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const hasHeroHighlightsRow =
    Boolean(publicHeroCountdown) || publicHeroHighlights.length > 0;
  const prizeSummary = contest.prize_pool_summary?.trim() ?? "";
  const hasPrizeSummary = prizeSummary.length > 0;
  const hasLiveMetaPanel = hasHeroHighlightsRow || hasPrizeSummary;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="order-2 flex flex-col gap-5 lg:order-1 lg:col-span-7">
            <header className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {translate("detail.labels.publicType")}
              </div>
              <TitleTag className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {contest.title}
              </TitleTag>
              {contest.tagline?.trim() ? (
                <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">
                  {contest.tagline}
                </p>
              ) : null}
            </header>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
                  badgeClass,
                )}
              >
                {showPulseDot ? (
                  <span className="relative flex size-2 shrink-0">
                    <span
                      className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-35"
                      aria-hidden
                    />
                    <span
                      className="relative inline-flex size-2 rounded-full bg-current"
                      aria-hidden
                    />
                  </span>
                ) : null}
                {lifecycleBadgeLabel}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9 gap-2"
                    >
                      <Share2 className="size-4" aria-hidden />
                      {translate("detail.hero.share")}
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="min-w-[200px]">
                  <DropdownMenuItem
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl).then(
                        () => {
                          toast.success(translate("detail.hero.shareCopied"));
                        },
                        () => {
                          toast.error(translate("detail.hero.shareCopyFailed"));
                        },
                      );
                    }}
                  >
                    {translate("detail.hero.shareCopyLink")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openShare(
                        `https://www.facebook.com/sharer/sharer.php?u=${shareEncoded}`,
                      )
                    }
                  >
                    {translate("detail.hero.shareFacebook")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openShare(
                        `https://twitter.com/intent/tweet?url=${shareEncoded}&text=${titleEncoded}`,
                      )
                    }
                  >
                    {translate("detail.hero.shareX")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      openShare(
                        `https://www.linkedin.com/sharing/share-offsite/?url=${shareEncoded}`,
                      )
                    }
                  >
                    {translate("detail.hero.shareLinkedIn")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {hasLiveMetaPanel ? (
              <div className="rounded-xl border border-border-subtle bg-surface-raised/60 p-4 dark:bg-surface-base/80">
                {hasHeroHighlightsRow ? (
                  <div className="space-y-3">
                    {publicHeroCountdown ? (
                      <p
                        aria-live="polite"
                        className={cn(
                          "text-sm font-medium tabular-nums text-foreground",
                          publicHeroCountdown.urgent &&
                            "text-red-600 dark:text-red-400",
                        )}
                      >
                        {publicHeroCountdown.text}
                      </p>
                    ) : null}
                    {publicHeroHighlights.length > 0 ? (
                      <ul className="flex list-none flex-col gap-1.5 p-0 text-sm text-foreground-muted sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                        {publicHeroHighlights.map((line) => (
                          <li
                            key={line}
                            className="flex min-w-0 items-start gap-2 sm:max-w-[min(100%,280px)]"
                          >
                            <span
                              className="mt-1.5 size-1 shrink-0 rounded-full bg-primary"
                              aria-hidden
                            />
                            <span className="leading-snug">{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                {hasPrizeSummary ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2 text-sm text-foreground",
                      hasHeroHighlightsRow &&
                        "mt-3 border-t border-border-subtle pt-3",
                    )}
                  >
                    <Trophy
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    <span className="min-w-0 font-medium leading-snug">
                      {prizeSummary}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <ContestDetailScheduleMetaStrip
              contest={contest}
              translate={translate}
              formatDateTime={formatDateTime}
              locationLabel={locationLabel}
              labelsMode="public"
            />
          </div>

          <div className="order-1 lg:order-2 lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <ContestHeroVisual contest={contest} translate={translate} />
          </div>
        </div>

        {implausibleStart && canAccessWorkspace ? (
          <p className="mt-4 rounded-md border border-warning bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
            {translate("detail.hero.implausibleStartWarning")}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
