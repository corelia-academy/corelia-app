import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { certificateAnalyticsQueryOptions } from "@/features/admin/adminQueries";
import { getCertificateAnalytics, certificateAnalyticsCsv, type CertificateAnalyticsFilters } from "@/lib/certificateAnalytics";
import { useAuth } from "@/stores/authStore";

const PAGE_SIZE = 25;
const INITIAL_FILTERS: CertificateAnalyticsFilters = { courseId: "", from: "", to: "", network: "" };

export default function AdminCertificateAnalytics() {
  const { t } = useTranslation("admin");
  const { user, profile } = useAuth();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const validRange = !filters.from || !filters.to || filters.from <= filters.to;
  const query = useQuery(certificateAnalyticsQueryOptions(user?.id, filters, page, profile?.role === "admin" && validRange));
  const result = query.data;
  const setFilter = <K extends keyof CertificateAnalyticsFilters>(key: K, value: CertificateAnalyticsFilters[K]) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(0);
  };
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
  const mail = (status: string | null) => {
    if (status === "accepted") return t("certificateAnalytics.mail.accepted");
    if (status === "provider_error") return t("certificateAnalytics.mail.provider_error");
    if (status === "skipped") return t("certificateAnalytics.mail.skipped");
    return t("certificateAnalytics.unknown");
  };
  const ocStatus = (status: string) => {
    if (status === "minted") return t("certificateAnalytics.status.minted");
    if (status === "pending") return t("certificateAnalytics.status.pending");
    return t("certificateAnalytics.status.failed");
  };

  async function exportCsv() {
    if (!result || exporting) return;
    setExporting(true);
    setExportError(false);
    try {
      const rows = [];
      for (let offset = 0; offset < result.total; offset += 500) {
        const batch = await getCertificateAnalytics(filters, offset, 500);
        rows.push(...batch.rows);
      }
      const blob = new Blob([certificateAnalyticsCsv(rows)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `corelia-certificates-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  if (profile?.role !== "admin") return <p role="alert">{t("certificateAnalytics.forbidden")}</p>;

  return <div className="space-y-6">
    <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-sm"><span>{t("certificateAnalytics.course")}</span>
        <select className="w-full rounded-md border border-border bg-surface-base px-3 py-2" value={filters.courseId} onChange={event => setFilter("courseId", event.target.value)}>
          <option value="">{t("certificateAnalytics.allCourses")}</option>
          {result?.courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm"><span>{t("certificateAnalytics.from")}</span><input className="w-full rounded-md border border-border bg-surface-base px-3 py-2" type="date" value={filters.from} onChange={event => setFilter("from", event.target.value)} /></label>
      <label className="space-y-1 text-sm"><span>{t("certificateAnalytics.to")}</span><input className="w-full rounded-md border border-border bg-surface-base px-3 py-2" type="date" value={filters.to} onChange={event => setFilter("to", event.target.value)} /></label>
      <label className="space-y-1 text-sm"><span>{t("certificateAnalytics.network")}</span>
        <select className="w-full rounded-md border border-border bg-surface-base px-3 py-2" value={filters.network} onChange={event => setFilter("network", event.target.value as CertificateAnalyticsFilters["network"])}>
          <option value="">{t("certificateAnalytics.allNetworks")}</option><option value="mainnet">Mainnet</option><option value="staging">Staging</option>
        </select>
      </label>
      {!validRange && <p role="alert" className="text-sm text-destructive sm:col-span-2">{t("certificateAnalytics.invalidRange")}</p>}
    </div>

    {query.isPending ? <p role="status">{t("certificateAnalytics.loading")}</p> : query.isError ? <p role="alert">{t("certificateAnalytics.loadError")}</p> : result && <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {(["completed", "corelia_issued", "corelia_revoked", "oca_minted", "oca_unresolved", "oca_pending", "oca_failed", "unique_learners"] as const).map(key =>
          <div className="rounded-lg border border-border p-3" key={key}><div className="text-xs text-foreground-muted">{t(`certificateAnalytics.summary.${key}`)}</div><div className="mt-1 text-2xl font-semibold tabular-nums">{result.summary[key]}</div></div>)}
      </div>
      <p className="text-sm text-foreground-muted">{t("certificateAnalytics.mintAttempts", { count: result.mint_attempts_logged })} · {t("certificateAnalytics.hint")}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">{t("certificateAnalytics.learnerRows", { count: result.total })}</h2>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>{t("certificateAnalytics.refresh")}</Button><Button type="button" onClick={() => void exportCsv()} disabled={exporting || result.total === 0}>{exporting ? t("certificateAnalytics.exporting") : t("certificateAnalytics.exportCsv")}</Button></div>
      </div>
      {exportError && <p role="alert" className="text-sm text-destructive">{t("certificateAnalytics.exportError")}</p>}
      <div className="overflow-x-auto rounded-lg border border-border" role="region" aria-label={t("certificateAnalytics.tableLabel")} tabIndex={0}>
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-surface-raised"><tr>{(["learner", "course", "completed", "corelia", "coreEmail", "coreNotice", "oca", "ocEmail", "ocNotice"] as const).map(key => <th key={key} scope="col" className="px-3 py-2">{t(`certificateAnalytics.columns.${key}`)}</th>)}</tr></thead>
          <tbody>{result.rows.length === 0 ? <tr><td colSpan={9} className="px-3 py-5 text-center text-foreground-muted">{t("certificateAnalytics.empty")}</td></tr> : result.rows.map(row => <tr key={`${row.user_id}:${row.course_id}`} className="border-t border-border align-top">
            <td className="px-3 py-3"><div className="font-medium">{row.learner_name}</div><div className="text-xs text-foreground-muted">{row.learner_email ?? "—"}</div></td>
            <td className="px-3 py-3">{row.course_title}</td>
            <td className="px-3 py-3 whitespace-nowrap">{formatDate(row.completed_at)}</td>
            <td className="px-3 py-3"><div>{row.revoked_at ? t("certificateAnalytics.revoked") : row.code ? t("certificateAnalytics.issued") : "—"}</div>{row.code && <div className="font-mono text-xs">{row.code}</div>}<div className="text-xs text-foreground-muted">{formatDate(row.issued_at)}</div></td>
            <td className="px-3 py-3">{mail(row.core_email)}</td><td className="px-3 py-3">{row.certificate_id ? row.core_notification ? t("certificateAnalytics.created") : t("certificateAnalytics.missing") : "—"}</td>
            <td className="px-3 py-3"><div>{row.oc_status === "minted" && !row.oc_credential_id ? t("certificateAnalytics.unresolved") : row.oc_status ? ocStatus(row.oc_status) : "—"}{row.network ? ` · ${row.network}` : ""}</div>{row.oc_credential_id && <div className="max-w-44 break-all font-mono text-xs">{row.oc_credential_id}</div>}{row.oc_status === "failed" && row.error_message && <div className="max-w-48 break-words text-xs text-destructive">{row.error_message}</div>}</td>
            <td className="px-3 py-3">{row.issuance_id ? mail(row.oc_email) : "—"}</td><td className="px-3 py-3">{row.issuance_id && row.oc_status === "minted" ? row.oc_notification ? t("certificateAnalytics.created") : t("certificateAnalytics.missing") : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3"><span className="text-sm text-foreground-muted">{t("certificateAnalytics.page", { page: page + 1, pages: Math.max(1, Math.ceil(result.total / PAGE_SIZE)) })}</span><div className="flex gap-2"><Button type="button" variant="outline" disabled={page === 0} onClick={() => setPage(current => current - 1)}>{t("certificateAnalytics.previous")}</Button><Button type="button" variant="outline" disabled={(page + 1) * PAGE_SIZE >= result.total} onClick={() => setPage(current => current + 1)}>{t("certificateAnalytics.next")}</Button></div></div>
    </>}
  </div>;
}
