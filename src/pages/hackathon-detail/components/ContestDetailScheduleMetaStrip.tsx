import { Calendar, MapPin, Timer, Users } from "lucide-react";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

/** Horizontal schedule summary: start → end, format, participant cap — matches public hackathon quick-stats / hero meta layout. */
export function ContestDetailScheduleMetaStrip(props: {
  contest: Contest;
  translate: (key: string, options?: Record<string, unknown>) => string;
  formatDateTime: (value: string | null) => string;
  locationLabel: (location: Contest["location"]) => string;
  labelsMode: "public" | "manage";
  className?: string;
}) {
  const {
    contest,
    translate,
    formatDateTime,
    locationLabel,
    labelsMode,
    className,
  } = props;

  const maxParticipants = contest.max_participants;
  const approvedCount = Number(
    contest.metrics_snapshot.approved_registrations ?? 0,
  );
  const slotRatio =
    maxParticipants != null && maxParticipants > 0
      ? approvedCount / maxParticipants
      : null;

  const startLabel =
    labelsMode === "manage"
      ? translate("workspace.manage.heroStart")
      : translate("detail.hero.start");
  const endLabel =
    labelsMode === "manage"
      ? translate("workspace.manage.heroEnd")
      : translate("detail.hero.end");
  const formatLabel =
    labelsMode === "manage"
      ? translate("workspace.manage.heroFormat")
      : translate("detail.hero.format");
  const limitLabel =
    labelsMode === "manage"
      ? translate("workspace.manage.heroApprovalLimit")
      : translate("detail.hero.participantLimit");

  return (
    <div
      className={cn(
        "grid grid-cols-2 rounded-lg border border-border-subtle bg-surface-base p-4 text-sm gap-4",
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-start gap-2">
        <Calendar className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 text-foreground">
          <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {startLabel}
          </span>
          <span className="mt-1 block font-medium">
            {formatDateTime(contest.starts_at)}
          </span>
        </span>
      </span>
      <span className="inline-flex min-w-0 items-start gap-2">
        <Timer className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 text-foreground">
          <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {endLabel}
          </span>
          <span className="mt-1 block font-medium">
            {formatDateTime(contest.ends_at)}
          </span>
        </span>
      </span>
      <span className="inline-flex min-w-0 items-start gap-2">
        <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 text-foreground">
          <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {formatLabel}
          </span>
          <span className="mt-1 block font-medium">
            {locationLabel(contest.location)}
          </span>
        </span>
      </span>
      <span className="flex min-w-[min(100%,220px)] flex-col gap-1.5">
        <span className="inline-flex items-center gap-2 text-foreground">
          <Users className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {limitLabel}
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
              className="h-2 w-full overflow-hidden rounded-full bg-surface-raised"
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
  );
}
