import {
  Calendar,
  MapPin,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPreviewBar } from "@/components/hackathons/AdminPreviewBar";
import type { ContestPublicSection } from "@/pages/hackathon-detail/types";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import {
  contestPhaseBadgeClassName,
  deriveContestPublicPhase,
} from "@/pages/hackathon-detail/utils/contestPhase";
import { cn } from "@/lib/utils";

export function ContestDetailHeroCard({
  vm,
  titleAs = "h1",
  publicSection,
}: {
  vm: ContestDetailViewModel;
  titleAs?: "h1" | "h2";
  publicSection?: ContestPublicSection;
}) {
  const { contest } = vm;
  const {
    translate,
    navigate,
    isManageView,
    activeManageSectionMeta,
    publicPhaseBadgeLabel,
    contestPublicPhase,
    publicHeroHighlights,
    formatDateTime,
    locationLabel,
    isManager,
    canJudge,
    viewerRoles,
    canAccessWorkspace,
    registration,
    publicCta,
  } = vm;

  const isPublicOverview =
    !isManageView && (!publicSection || publicSection === "overview");
  const hideHeroPublicCta =
    isPublicOverview && registration?.status === "approved";

  const TitleTag = titleAs;

  const phaseForBadge = contestPublicPhase ?? deriveContestPublicPhase(contest);
  const badgeClass = contestPhaseBadgeClassName(phaseForBadge);
  const showPulseDot =
    phaseForBadge === "registration_open" || phaseForBadge === "in_progress";

  const maxParticipants = contest.max_participants;
  const approvedCount = Number(
    contest.metrics_snapshot.approved_registrations ?? 0,
  );
  const slotRatio =
    maxParticipants != null && maxParticipants > 0
      ? approvedCount / maxParticipants
      : null;

  const implausibleStart =
    contest.starts_at &&
    contest.created_at &&
    new Date(contest.starts_at).getTime() <
      new Date(contest.created_at).getTime();

  return (
    <Card className="overflow-hidden">
      {contest.cover_image_url?.trim() ? (
        <div className="relative aspect-21/9 max-h-[min(360px,40vh)] w-full bg-surface-raised">
          <img
            src={contest.cover_image_url.trim()}
            alt={translate("detail.visual.bannerAlt", {
              title: contest.title,
            })}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {isManageView
                ? translate("detail.labels.manageArea")
                : translate("detail.labels.publicType")}
            </div>
            <TitleTag className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {contest.title}
            </TitleTag>
            {contest.tagline?.trim() ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground-muted">
                {isManageView ? activeManageSectionMeta.description : contest.tagline}
              </p>
            ) : isManageView ? (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground-muted">
                {activeManageSectionMeta.description}
              </p>
            ) : null}

            {!isManageView && publicHeroHighlights.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-2 text-sm text-foreground-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
                {publicHeroHighlights.map((line) => (
                  <li
                    key={line}
                    className="flex min-w-0 max-w-full items-start gap-2"
                  >
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {!isManageView && contest.prize_pool_summary?.trim() ? (
              <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm text-foreground">
                <Trophy className="size-4 shrink-0 text-primary" aria-hidden />
                <span>{contest.prize_pool_summary.trim()}</span>
              </div>
            ) : null}
          </div>

          {!isManageView ? (
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
                  <span className="relative inline-flex size-2 rounded-full bg-current" aria-hidden />
                </span>
              ) : null}
              {publicPhaseBadgeLabel}
            </span>
          ) : (
            <span className="w-fit rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-foreground-muted">
              {vm.statusLabel(contest.status)}
            </span>
          )}
        </div>

        {implausibleStart && canAccessWorkspace ? (
          <p className="mt-4 rounded-md border border-warning bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
            {translate("detail.hero.implausibleStartWarning")}
          </p>
        ) : null}

        {isManageView && (
          <div className="mt-4 flex flex-wrap gap-2">
            {isManager && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                {translate("workspace.manage.roleCoreliaOps")}
              </span>
            )}
            {canJudge && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                {translate("workspace.manage.roleJudgePanel")}
              </span>
            )}
            {viewerRoles.includes("co_host_viewer") && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-raised px-3 py-2 text-xs font-medium text-foreground">
                {translate("workspace.manage.roleCoHostObserver")}
              </span>
            )}
          </div>
        )}

        {!isManageView && canAccessWorkspace ? (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AdminPreviewBar
              statusLabel={vm.statusLabel(contest.status)}
              primaryAction={{
                label: translate("previewBar.openWorkspace"),
                to: contest.slug ? `/hackathons/${contest.slug}/manage` : "/hackathons/manage",
              }}
            />
            <Button
              type="button"
              className="min-h-11 sm:w-auto"
              variant="outline"
              onClick={() =>
                navigate(
                  contest.slug ? `/hackathons/${contest.slug}/manage` : "/hackathons/manage",
                )
              }
            >
              {translate("previewBar.openWorkspace")}
            </Button>
          </div>
        ) : null}

        {!isManageView && publicCta && !hideHeroPublicCta ? (
          <div className="mt-5 rounded-md border border-border-subtle bg-surface-raised p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                  {translate("detail.cta.nextStepEyebrow")}
                </div>
                <div className="mt-1 text-sm leading-relaxed text-foreground">
                  {publicCta.helper}
                </div>
              </div>
              <Button
                type="button"
                className="w-full min-h-11 sm:w-auto"
                variant={publicCta.variant}
                onClick={() => navigate(publicCta.navigateTo)}
              >
                {publicCta.label}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4 rounded-md border border-border-subtle bg-surface-base p-4 text-sm">
          <span className="inline-flex min-w-0 items-start gap-2">
            <Calendar className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 text-foreground">
              <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {isManageView
                  ? translate("workspace.manage.heroStart")
                  : translate("detail.hero.start")}
              </span>
              <span className="mt-1 block">
                {formatDateTime(contest.starts_at)}
              </span>
            </span>
          </span>
          <span className="hidden text-foreground-muted sm:inline" aria-hidden>
            →
          </span>
          <span className="inline-flex min-w-0 items-start gap-2">
            <Timer className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 text-foreground">
              <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {isManageView
                  ? translate("workspace.manage.heroEnd")
                  : translate("detail.hero.end")}
              </span>
              <span className="mt-1 block">
                {formatDateTime(contest.ends_at)}
              </span>
            </span>
          </span>
          <span className="inline-flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 text-foreground">
              <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {isManageView
                  ? translate("workspace.manage.heroFormat")
                  : translate("detail.hero.format")}
              </span>
              <span className="mt-1 block">{locationLabel(contest.location)}</span>
            </span>
          </span>
          <span className="flex min-w-[min(100%,220px)] flex-col gap-1.5">
            <span className="inline-flex items-center gap-2 text-foreground">
              <Users className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {isManageView
                  ? translate("workspace.manage.heroApprovalLimit")
                  : translate("detail.hero.participantLimit")}
              </span>
            </span>
            {maxParticipants != null ? (
              <>
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {translate("detail.hero.slotsFilled", {
                    approved: approvedCount,
                    max: maxParticipants,
                  })}
                </span>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
                  role="progressbar"
                  aria-valuenow={approvedCount}
                  aria-valuemin={0}
                  aria-valuemax={maxParticipants}
                  aria-label={translate("detail.hero.slotsFilled", {
                    approved: approvedCount,
                    max: maxParticipants,
                  })}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-colors",
                      slotRatio != null && slotRatio >= 1
                        ? "bg-destructive"
                        : slotRatio != null && slotRatio >= 0.8
                          ? "bg-warning"
                          : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min(100, (slotRatio ?? 0) * 100)}%`,
                    }}
                  />
                </div>
              </>
            ) : (
              <span className="text-sm text-foreground-muted">
                {translate("detail.hero.slotsUnlimited")}
              </span>
            )}
          </span>
        </div>

        {isManageView && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-border-subtle bg-surface-base p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {translate("workspace.manage.overviewApplications")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(contest.metrics_snapshot.registrations_total ?? 0)}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-base p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {translate("workspace.manage.overviewApproved")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(contest.metrics_snapshot.approved_registrations ?? 0)}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-base p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {translate("workspace.manage.overviewSubmissions")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(contest.metrics_snapshot.submissions_total ?? 0)}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-surface-base p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                {translate("workspace.manage.overviewScored")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(contest.metrics_snapshot.scored_submissions ?? 0)}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
