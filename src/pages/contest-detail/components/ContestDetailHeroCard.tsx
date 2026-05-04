import { Calendar, MapPin, Timer, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminPreviewBar } from "@/components/contests/AdminPreviewBar";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

export function ContestDetailHeroCard({ vm }: { vm: ContestDetailViewModel }) {
  const { contest } = vm;
  const {
    translate,
    navigate,
    isManageView,
    activeManageSectionMeta,
    registrationCountdownLabel,
    contestEndsLabel,
    statusLabel,
    formatDateTime,
    locationLabel,
    isManager,
    canJudge,
    viewerRoles,
    canAccessWorkspace,
    registration,
    publicCta,
  } = vm;

  return (
    <Card className="overflow-hidden">
      {contest.cover_image_url?.trim() ? (
        <div className="relative aspect-[21/9] max-h-[min(360px,40vh)] w-full bg-muted">
          <img
            src={contest.cover_image_url.trim()}
            alt={translate("detail.visual.bannerAlt", {
              title: contest.title,
            })}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {isManageView
                ? translate("detail.labels.manageArea")
                : translate("detail.labels.publicType")}
            </div>
            <h1 className="mt-2 text-3xl font-normal tracking-tight text-foreground">
              {contest.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {isManageView
                ? activeManageSectionMeta.description
                : contest.tagline}
            </p>
            {!isManageView && contest.prize_pool_summary?.trim() ? (
              <p className="mt-3 text-sm font-medium text-foreground">
                {contest.prize_pool_summary}
              </p>
            ) : null}
            {!isManageView ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users
                    className="size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  {translate("detail.hero.applicationsLine", {
                    total: contest.metrics_snapshot.registrations_total,
                  })}
                </span>
                {contest.metrics_snapshot.pending_registrations > 0 ? (
                  <span>
                    {translate("detail.hero.pendingLine", {
                      count:
                        contest.metrics_snapshot.pending_registrations,
                    })}
                  </span>
                ) : null}
                {contest.metrics_snapshot.approved_registrations > 0 ? (
                  <span>
                    {translate("detail.hero.approvedLine", {
                      count:
                        contest.metrics_snapshot.approved_registrations,
                    })}
                  </span>
                ) : null}
                {registrationCountdownLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    {registrationCountdownLabel}
                  </span>
                ) : null}
                {contestEndsLabel ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Timer
                      className="size-4 shrink-0 text-primary"
                      aria-hidden
                    />
                    {contestEndsLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {statusLabel(contest.status)}
          </span>
        </div>

        {isManageView && (
          <div className="mt-4 flex flex-wrap gap-2">
            {isManager && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                {translate("workspace.manage.roleCoreliaOps")}
              </span>
            )}
            {canJudge && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                {translate("workspace.manage.roleJudgePanel")}
              </span>
            )}
            {viewerRoles.includes("co_host_viewer") && (
              <span className="inline-flex items-center rounded-full border border-border-subtle bg-muted/50 px-3 py-2 text-xs font-medium text-foreground">
                {translate("workspace.manage.roleCoHostObserver")}
              </span>
            )}
          </div>
        )}

        {!isManageView && canAccessWorkspace ? (
          <AdminPreviewBar
            statusLabel={statusLabel(contest.status)}
            primaryAction={{
              label: translate("previewBar.openWorkspace"),
              to: `/admin/contests/${contest.id}/manage`,
            }}
          />
        ) : null}

        {!isManageView && publicCta && (
          <div className="mt-5 rounded-2xl border border-border-subtle bg-muted/25 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {translate("detail.cta.nextStepEyebrow")}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {publicCta.helper}
                </div>
              </div>
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant={
                  contest.status === "published" && !registration
                    ? "default"
                    : "outline"
                }
                onClick={() =>
                  navigate(
                    contest.status === "published"
                      ? `/contests/${contest.id}/apply#participant-workspace`
                      : `/contests/${contest.id}/timeline`,
                  )
                }
              >
                {publicCta.label}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-background p-4">
            <div className="flex items-center gap-3">
              <Calendar className="size-5 text-primary" aria-hidden />
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {isManageView
                    ? translate("workspace.manage.heroStart")
                    : translate("detail.hero.start")}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {formatDateTime(contest.starts_at)}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-background p-4">
            <div className="flex items-center gap-3">
              <Timer className="size-5 text-primary" aria-hidden />
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {isManageView
                    ? translate("workspace.manage.heroEnd")
                    : translate("detail.hero.end")}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {formatDateTime(contest.ends_at)}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-background p-4">
            <div className="flex items-center gap-3">
              <MapPin className="size-5 text-primary" aria-hidden />
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {isManageView
                    ? translate("workspace.manage.heroFormat")
                    : translate("detail.hero.format")}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {locationLabel(contest.location)}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-background p-4">
            <div className="flex items-center gap-3">
              <Users className="size-5 text-primary" aria-hidden />
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {isManageView
                    ? translate("workspace.manage.heroApprovalLimit")
                    : translate("detail.hero.participantLimit")}
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {contest.max_participants ??
                    translate("detail.labels.unlimited")}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isManageView && (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("workspace.manage.overviewApplications")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(
                  contest.metrics_snapshot.registrations_total ?? 0,
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("workspace.manage.overviewApproved")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(
                  contest.metrics_snapshot.approved_registrations ?? 0,
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("workspace.manage.overviewSubmissions")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(contest.metrics_snapshot.submissions_total ?? 0)}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("workspace.manage.overviewScored")}
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                {Number(contest.metrics_snapshot.scored_submissions ?? 0)}
              </div>
            </div>
          </div>
        )}

        {!isManageView && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("detail.public.infoCards.reviewTitle")}
              </div>
              <div className="mt-2 text-sm text-foreground">
                {translate("detail.public.infoCards.reviewBody")}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("detail.public.infoCards.teamSubmitTitle")}
              </div>
              <div className="mt-2 text-sm text-foreground">
                {translate("detail.public.infoCards.teamSubmitBody")}
              </div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-muted/25 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {translate("detail.public.infoCards.resultsTitle")}
              </div>
              <div className="mt-2 text-sm text-foreground">
                {translate("detail.public.infoCards.resultsBody")}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
