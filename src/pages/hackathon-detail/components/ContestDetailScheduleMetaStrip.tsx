import type { ComponentType } from "react";
import { Calendar, MapPin, Timer, Upload } from "lucide-react";
import type { Contest } from "@/types/hackathons";
import { cn } from "@/lib/utils";

type Translate = (key: string, options?: Record<string, unknown>) => string;

function MetaCell({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 text-foreground">
        <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
          {label}
        </div>
        <div className="mt-1 font-medium">{value}</div>
        {hint ? (
          <div className="mt-1 text-xs leading-snug text-foreground-muted">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Horizontal schedule summary: start → end, optional submission deadline, format/location.
 * Renders as an even grid that stacks at xs (1 col) → sm (2 cols) → md (3 or 4 cols depending
 * on whether the submission deadline is present). Skips the visible card-in-card border so
 * the strip blends with whichever surface hosts it.
 */
export function ContestDetailScheduleMetaStrip(props: {
  contest: Contest;
  translate: Translate;
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

  const t = (publicKey: string, manageKey: string) =>
    translate(labelsMode === "manage" ? manageKey : publicKey);

  const submissionDeadlineIso = contest.submission_deadline?.trim() ?? "";
  const hasSubmission = submissionDeadlineIso.length > 0;

  const endHint =
    !hasSubmission && contest.ends_at?.trim()
      ? translate("detail.hero.submissionsLockAtEndHint")
      : undefined;

  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-4 rounded-md border border-border-subtle bg-surface-raised p-4 text-sm sm:grid-cols-2",
        hasSubmission ? "md:grid-cols-4" : "md:grid-cols-3",
        className,
      )}
    >
      <MetaCell
        icon={Calendar}
        label={t("detail.hero.start", "workspace.manage.heroStart")}
        value={formatDateTime(contest.starts_at)}
      />
      <MetaCell
        icon={Timer}
        label={t("detail.hero.end", "workspace.manage.heroEnd")}
        value={formatDateTime(contest.ends_at)}
        hint={endHint}
      />
      {hasSubmission ? (
        <MetaCell
          icon={Upload}
          label={t(
            "detail.hero.submissionDeadline",
            "workspace.manage.submissionDeadlineLabel",
          )}
          value={formatDateTime(contest.submission_deadline)}
        />
      ) : null}
      <MetaCell
        icon={MapPin}
        label={t("detail.hero.format", "workspace.manage.heroFormat")}
        value={locationLabel(contest.location)}
      />
    </div>
  );
}
