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
    <div className="group/cell flex min-w-0 items-start gap-3 rounded-lg p-2.5 transition-all duration-200 hover:bg-surface-base hover:shadow-xs border border-transparent hover:border-border-subtle">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover/cell:bg-primary group-hover/cell:text-primary-foreground transition-all duration-200">
        <Icon className="size-4 shrink-0" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-foreground">
        <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted group-hover/cell:text-primary transition-colors">
          {label}
        </div>
        <div className="mt-1 text-xs sm:text-sm font-medium leading-snug break-words">
          {value}
        </div>
        {hint ? (
          <div className="mt-1 text-2xs leading-snug text-foreground-subtle">
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
        "grid gap-4 rounded-xl border border-border-subtle bg-surface-raised/60 p-3 text-sm sm:grid-cols-2",
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
