import { ArrowRight, Share2, Trophy } from "lucide-react";
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
  type HackathonLifecycle,
} from "@/pages/hackathon-detail/utils/contestLifecycle";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Full-bleed banner shown at the top of the hero card. Locked to **21:9** at every breakpoint
 * to match the upload guidance in Settings ("Recommended: 21:9 ratio, at least 1680x720") so
 * uploaded assets render edge-to-edge without sideways cropping. Returns null when no
 * cover/thumbnail is present so the hero collapses cleanly to the text-only header below.
 */
function HackathonHeroBanner({
  contest,
  translate,
}: {
  contest: Contest;
  translate: Translate;
}) {
  const src =
    contest.cover_image_url?.trim() || contest.thumbnail_url?.trim() || null;
  if (!src) return null;
  return (
    <div className="relative aspect-[21/9] w-full overflow-hidden bg-surface-raised">
      <img
        src={src}
        alt={translate("detail.visual.bannerAlt", { title: contest.title })}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function HackathonLifecyclePill({
  lifecycle,
  label,
}: {
  lifecycle: HackathonLifecycle;
  label: string;
}) {
  const badgeClass = hackathonLifecycleBadgeClassName(lifecycle);
  const showPulseDot = hackathonLifecycleShowsPulseDot(lifecycle);
  return (
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
      {label}
    </span>
  );
}

function HackathonShareMenu({
  contest,
  translate,
}: {
  contest: Contest;
  translate: Translate;
}) {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareEncoded = encodeURIComponent(shareUrl);
  const titleEncoded = encodeURIComponent(contest.title);
  const openShare = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-2"
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
              () => toast.success(translate("detail.hero.shareCopied")),
              () => toast.error(translate("detail.hero.shareCopyFailed")),
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
  );
}

function PublicHero({
  vm,
  TitleTag,
}: {
  vm: ContestDetailViewModel;
  TitleTag: "h1" | "h2";
}) {
  const {
    contest,
    translate,
    lifecycleBadgeLabel,
    hackathonLifecycle,
    publicHeroHighlights,
    publicHeroCountdown,
    publicCta,
    formatDateTime,
    locationLabel,
    navigate,
  } = vm;
  const lifecycleForBadge =
    hackathonLifecycle ?? deriveHackathonLifecycle(contest);
  const prizeSummary = contest.prize_pool_summary?.trim() ?? "";
  const Tag = TitleTag;
  /**
   * Once a contest has ended, the "Ended" lifecycle pill already conveys "concluded"; the
   * highlights list typically repeats the same status sentence. Hide the list to avoid the
   * lonely "• This contest has concluded" bullet that adds visual noise without info.
   */
  const showHighlights =
    lifecycleForBadge !== "ended" && publicHeroHighlights.length > 0;

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card">
      <Card className="overflow-hidden border-none bg-transparent shadow-none">
        <HackathonHeroBanner contest={contest} translate={translate} />
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="space-y-4">
              <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground-muted">
                    <span>{translate("detail.labels.publicType")}</span>
                    <span className="text-foreground-subtle/50">•</span>
                    <HackathonLifecyclePill
                      lifecycle={lifecycleForBadge}
                      label={lifecycleBadgeLabel}
                    />
                  </div>
                  <Tag className="text-2xl font-semibold tracking-tight text-foreground">
                    {contest.title}
                  </Tag>
                </div>
                <div className="mt-1 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  {publicCta ? (
                    <Button
                      type="button"
                      size="lg"
                      variant={publicCta.variant}
                      className="min-h-11 gap-2"
                      disabled={Boolean(publicCta.disabled)}
                      onClick={() => navigate(publicCta.navigateTo)}
                    >
                      <span className="max-w-[18rem] truncate">
                        {publicCta.label}
                      </span>
                      {!publicCta.disabled ? (
                        <ArrowRight className="size-4" aria-hidden />
                      ) : null}
                    </Button>
                  ) : null}
                  <HackathonShareMenu contest={contest} translate={translate} />
                </div>
              </header>

              {contest.tagline?.trim() ? (
                <p className="max-w-3xl text-sm leading-relaxed text-foreground-muted">
                  {contest.tagline}
                </p>
              ) : null}

              {prizeSummary ? (
                <div className="flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary-muted px-3 py-1.5 text-xs font-semibold text-primary transition-colors duration-150">
                  <Trophy className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 leading-snug">{prizeSummary}</span>
                </div>
              ) : null}

              {publicCta?.helper ? (
                <p className="max-w-2xl text-xs leading-relaxed text-foreground-muted">
                  {publicCta.helper}
                </p>
              ) : null}
            </div>

            {publicHeroCountdown ? (
              <p
                aria-live="polite"
                className={cn(
                  "text-sm font-medium tabular-nums",
                  publicHeroCountdown.urgent
                    ? "text-destructive"
                    : "text-foreground",
                )}
              >
                {publicHeroCountdown.text}
              </p>
            ) : null}

            {showHighlights ? (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-foreground-muted sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
                {publicHeroHighlights.map((line) => (
                  <li key={line} className="flex min-w-0 items-start gap-2">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden
                    />
                    <span className="leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <ContestDetailScheduleMetaStrip
              contest={contest}
              translate={translate}
              formatDateTime={formatDateTime}
              locationLabel={locationLabel}
              labelsMode="public"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ManageHero({
  vm,
  TitleTag,
}: {
  vm: ContestDetailViewModel;
  TitleTag: "h1" | "h2";
}) {
  const {
    contest,
    translate,
    lifecycleBadgeLabel,
    hackathonLifecycle,
    formatDateTime,
    locationLabel,
    navigate,
  } = vm;
  const lifecycleForBadge =
    hackathonLifecycle ?? deriveHackathonLifecycle(contest);
  const Tag = TitleTag;
  const implausibleStart =
    contest.starts_at &&
    contest.created_at &&
    new Date(contest.starts_at).getTime() <
      new Date(contest.created_at).getTime();

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <header className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {translate("workspace.manage.heroEyebrow")}
            </div>
            <Tag className="text-2xl font-semibold tracking-tight text-foreground">
              {contest.title}
            </Tag>
            {contest.tagline?.trim() ? (
              <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted">
                {contest.tagline}
              </p>
            ) : null}
          </header>

          <div className="flex flex-wrap items-center gap-2">
            <HackathonLifecyclePill
              lifecycle={lifecycleForBadge}
              label={lifecycleBadgeLabel}
            />
            <span className="rounded-full bg-surface-raised px-3 py-1 text-xs font-medium text-foreground-muted">
              {vm.statusLabel(contest.status)}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
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

          <ContestDetailScheduleMetaStrip
            contest={contest}
            translate={translate}
            formatDateTime={formatDateTime}
            locationLabel={locationLabel}
            labelsMode="manage"
          />

          {implausibleStart ? (
            <p className="rounded-md border border-warning bg-warning/15 px-3 py-2 text-xs text-warning-foreground">
              {translate("detail.hero.implausibleStartWarning")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function ContestDetailHeroCard({
  vm,
  titleAs = "h1",
}: {
  vm: ContestDetailViewModel;
  titleAs?: "h1" | "h2";
}) {
  if (vm.isManageView) return <ManageHero vm={vm} TitleTag={titleAs} />;
  return <PublicHero vm={vm} TitleTag={titleAs} />;
}
