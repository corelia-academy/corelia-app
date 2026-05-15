import { Calendar, MapPin, Timer, Upload } from "lucide-react";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

/** Horizontal schedule summary: start → end, optional submission deadline, format/location. */
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
  const submissionDeadlineLabel =
    labelsMode === "manage"
      ? translate("workspace.manage.submissionDeadlineLabel")
      : translate("detail.hero.submissionDeadline");

  const submissionDeadlineIso = contest.submission_deadline?.trim() ?? "";

  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border-subtle bg-surface-base p-4 text-sm gap-4",
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
          {!submissionDeadlineIso && contest.ends_at?.trim() ? (
            <span className="mt-1 block text-xs leading-snug text-foreground-muted">
              {translate("detail.hero.submissionsLockAtEndHint")}
            </span>
          ) : null}
        </span>
      </span>
      {submissionDeadlineIso ? (
        <span className="col-span-2 inline-flex min-w-0 items-start gap-2 border-t border-border-subtle pt-4">
          <Upload className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 text-foreground">
            <span className="block text-xs font-semibold uppercase tracking-widest text-foreground-muted">
              {submissionDeadlineLabel}
            </span>
            <span className="mt-1 block font-medium">
              {formatDateTime(contest.submission_deadline)}
            </span>
          </span>
        </span>
      ) : null}
      <span className="col-span-2 inline-flex min-w-0 items-start gap-2 border-t border-border-subtle pt-4">
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
    </div>
  );
}
