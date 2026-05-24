import type { Contest } from "@/types/hackathons";

type Translate = (key: string, options?: Record<string, unknown>) => string;

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

/** 4-tile snapshot of registration + submission counts for the manage Overview tab. */
export function ContestManageMetricsTiles({
  contest,
  translate,
}: {
  contest: Contest;
  translate: Translate;
}) {
  const m = contest.metrics_snapshot;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricTile
        label={translate("workspace.manage.overviewApplications")}
        value={Number(m.registrations_total ?? 0)}
      />
      <MetricTile
        label={translate("workspace.manage.overviewApproved")}
        value={Number(m.approved_registrations ?? 0)}
      />
      <MetricTile
        label={translate("workspace.manage.overviewSubmissions")}
        value={Number(m.submissions_total ?? 0)}
      />
      <MetricTile
        label={translate("workspace.manage.overviewScored")}
        value={Number(m.scored_submissions ?? 0)}
      />
    </div>
  );
}
