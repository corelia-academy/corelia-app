import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ExternalLink,
  Flag,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminErrorBanner } from "@/features/admin/ui/AdminErrorBanner";
import { AdminStatsCard } from "@/features/admin/ui/AdminStatsCard";
import {
  listCourseReports,
  updateCourseReport,
  type CourseReport,
  type CourseReportPriority,
  type CourseReportReason,
  type CourseReportStatus,
} from "@/lib/courseReports";
import { useAuth } from "@/stores/authStore";

const inputClass =
  "h-9 rounded-md border border-border bg-surface-base px-3 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";

const statuses: Array<CourseReportStatus | "all"> = [
  "all",
  "open",
  "reviewing",
  "resolved",
  "rejected",
];
const reasons: Array<CourseReportReason | "all"> = [
  "all",
  "copyright",
  "spam",
  "misleading",
  "unsafe",
  "other",
];
const priorities: CourseReportPriority[] = ["low", "normal", "high", "urgent"];

function label(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function metadataText(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

export default function AdminCourseReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<CourseReport[]>([]);
  const [status, setStatus] = useState<CourseReportStatus | "all">("open");
  const [reason, setReason] = useState<CourseReportReason | "all">("all");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setReports(await listCourseReports({ status, reason }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reason]);

  const stats = useMemo(() => {
    const open = reports.filter((report) => report.status === "open").length;
    const reviewing = reports.filter((report) => report.status === "reviewing").length;
    const urgent = reports.filter((report) => report.priority === "urgent").length;
    const copyright = reports.filter((report) => report.reason === "copyright").length;
    return { total: reports.length, open, reviewing, urgent, copyright };
  }, [reports]);

  async function handleUpdate(
    report: CourseReport,
    patch: Partial<Pick<CourseReport, "status" | "priority" | "resolution_note">>,
  ) {
    setSavingId(report.id);
    try {
      await updateCourseReport(report.id, {
        ...patch,
        reviewer_id: profile?.id ?? null,
      });
      setReports((prev) =>
        prev.map((item) =>
          item.id === report.id
            ? {
                ...item,
                ...patch,
                reviewer_id: profile?.id ?? item.reviewer_id,
                updated_at: new Date().toISOString(),
                resolved_at:
                  patch.status === "resolved" || patch.status === "rejected"
                    ? new Date().toISOString()
                    : null,
              }
            : item,
        ),
      );
      toast.success("Report updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update report.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatsCard label="Total reports" value={stats.total} icon={<Flag className="size-5" aria-hidden />} />
        <AdminStatsCard label="Open" value={stats.open} icon={<AlertTriangle className="size-5" aria-hidden />} />
        <AdminStatsCard label="Reviewing" value={stats.reviewing} icon={<ShieldCheck className="size-5" aria-hidden />} />
        <AdminStatsCard label="Urgent" value={stats.urgent} icon={<AlertTriangle className="size-5" aria-hidden />} />
        <AdminStatsCard label="Copyright" value={stats.copyright} icon={<Flag className="size-5" aria-hidden />} />
      </div>

      <div className="mt-6 rounded-2xl border border-border-subtle bg-surface-base p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Course reports moderation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground-muted">
              Review DMCA, spam, safety, and quality reports submitted from public course pages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as CourseReportStatus | "all")}>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  Status: {label(item)}
                </option>
              ))}
            </select>
            <select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value as CourseReportReason | "all")}>
              {reasons.map((item) => (
                <option key={item} value={item}>
                  Reason: {label(item)}
                </option>
              ))}
            </select>
            <Button type="button" variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCcw className="size-4" aria-hidden />}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? <AdminErrorBanner message={error} /> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
        <div className="border-b border-border-subtle bg-surface-raised px-4 py-3 text-sm text-foreground-muted">
          {loading ? "Loading reports..." : `Showing ${reports.length} reports`}
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-foreground-muted">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-foreground-muted">
            No reports match the current filters.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {reports.map((report) => {
              const courseTitle = metadataText(report.metadata, "courseTitle") || report.course_id;
              const pageUrl = metadataText(report.metadata, "pageUrl");
              return (
                <article key={report.id} className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground">
                        {label(report.reason)}
                      </span>
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground">
                        {label(report.status)}
                      </span>
                      <span className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground">
                        Priority: {label(report.priority)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground">{courseTitle}</h3>
                    <p className="mt-1 break-all text-xs text-foreground-muted">
                      Course ID: {report.course_id} · Reporter: {report.reporter_id}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap rounded-xl border border-border-subtle bg-surface-raised p-3 text-sm leading-relaxed text-foreground">
                      {report.details}
                    </p>
                    {report.contact_email ? (
                      <p className="mt-2 text-xs text-foreground-muted">Contact: {report.contact_email}</p>
                    ) : null}
                    {report.resolution_note ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-foreground-muted">
                        Resolution: {report.resolution_note}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid h-fit gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3">
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <select
                        className={inputClass}
                        value={report.status}
                        disabled={savingId === report.id}
                        onChange={(event) =>
                          void handleUpdate(report, { status: event.target.value as CourseReportStatus })
                        }
                      >
                        {statuses.filter((item) => item !== "all").map((item) => (
                          <option key={item} value={item}>
                            {label(item)}
                          </option>
                        ))}
                      </select>
                      <select
                        className={inputClass}
                        value={report.priority}
                        disabled={savingId === report.id}
                        onChange={(event) =>
                          void handleUpdate(report, { priority: event.target.value as CourseReportPriority })
                        }
                      >
                        {priorities.map((item) => (
                          <option key={item} value={item}>
                            {label(item)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-lg border border-border bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                      defaultValue={report.resolution_note ?? ""}
                      placeholder="Resolution note..."
                      onBlur={(event) => {
                        if (event.target.value.trim() !== (report.resolution_note ?? "")) {
                          void handleUpdate(report, { resolution_note: event.target.value });
                        }
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => window.open(`/courses/${report.course_id}`, "_blank", "noopener")}>
                        Open course
                        <ExternalLink className="size-3.5" aria-hidden />
                      </Button>
                      {pageUrl ? (
                        <Button type="button" size="sm" variant="ghost" onClick={() => window.open(pageUrl, "_blank", "noopener")}>
                          Reported URL
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
