import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  listManualMintHistoryForAdmin,
  type ManualMintHistoryRow,
} from "@/lib/manualMintHistory";

function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

export function ManualMintHistoryTable() {
  const { t } = useTranslation("admin");
  const [rows, setRows] = useState<ManualMintHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManualMintHistoryForAdmin();
      setRows(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t("manualMint.history.loadFailed"),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      // Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      // Kind filter
      if (kindFilter !== "all" && item.templateKind !== kindFilter) {
        return false;
      }
      // Search query
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = item.recipientName.toLowerCase().includes(q);
        const matchEmail = item.recipientEmail.toLowerCase().includes(q);
        const matchOcid = item.recipientOcid?.toLowerCase().includes(q);
        const matchBadge = item.templateName.toLowerCase().includes(q);
        const matchReason = item.grantedReason?.toLowerCase().includes(q);
        const matchGranter = item.granterName?.toLowerCase().includes(q);
        if (
          !matchName &&
          !matchEmail &&
          !matchOcid &&
          !matchBadge &&
          !matchReason &&
          !matchGranter
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, kindFilter, search]);

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("manualMint.history.heading")}
          </h2>
          <p className="text-xs text-foreground-muted">
            {t("manualMint.history.subheading")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fetchHistory()}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          <RefreshCw
            className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
          />
          {t("manualMint.history.refresh")}
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border-subtle bg-surface-raised p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("manualMint.history.searchPlaceholder")}
            className="h-9 pl-8 text-xs"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-foreground-muted font-medium">
            {t("manualMint.history.statusCol")}:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-border-subtle bg-surface-base px-2.5 text-xs text-foreground outline-none focus-visible:border-primary"
          >
            <option value="all">{t("manualMint.history.filterStatusAll")}</option>
            <option value="minted">{t("manualMint.history.filterStatusMinted")}</option>
            <option value="pending">{t("manualMint.history.filterStatusPending")}</option>
            <option value="failed">{t("manualMint.history.filterStatusFailed")}</option>
          </select>
        </div>

        {/* Kind Filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-foreground-muted font-medium">
            {t("manualMint.form.kind")}:
          </span>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="h-9 rounded-md border border-border-subtle bg-surface-base px-2.5 text-xs text-foreground outline-none focus-visible:border-primary"
          >
            <option value="all">{t("manualMint.history.filterKindAll")}</option>
            <option value="oca">{t("manualMint.history.filterKindOca")}</option>
            <option value="ocb">{t("manualMint.history.filterKindOcb")}</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
            <Loader2 className="mb-2 size-6 animate-spin text-primary" />
            <p className="text-xs">{t("manualMint.lookup.loading")}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-foreground-muted">
            <p className="text-sm font-medium">{t("manualMint.history.empty")}</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-foreground-muted">
            <p className="text-sm font-medium">
              {t("manualMint.history.emptyFiltered")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-subtle bg-surface-raised/50 text-foreground-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">
                    {t("manualMint.history.recipientCol")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("manualMint.history.badgeCol")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("manualMint.history.granterCol")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("manualMint.history.statusCol")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("manualMint.history.reasonCol")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("manualMint.history.dateCol")}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    {t("manualMint.history.actionsCol")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredRows.map((row) => {
                  return (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-surface-raised/40"
                    >
                      {/* Recipient */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {row.recipientAvatarUrl ? (
                            <img
                              src={row.recipientAvatarUrl}
                              alt=""
                              className="size-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-foreground-muted border border-border-subtle">
                              <User className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {row.recipientName}
                            </p>
                            <p className="truncate text-[11px] text-foreground-muted">
                              {row.recipientEmail}
                            </p>
                            {row.recipientOcid ? (
                              <span className="mt-0.5 inline-block rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                                {row.recipientOcid.endsWith(".edu")
                                  ? row.recipientOcid
                                  : `${row.recipientOcid}.edu`}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Badge / Credential */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {row.templateImageUrl ? (
                            <img
                              src={row.templateImageUrl}
                              alt=""
                              className="size-8 shrink-0 rounded object-contain bg-surface-raised p-0.5 border border-border-subtle"
                            />
                          ) : (
                            <div className="flex size-8 shrink-0 items-center justify-center rounded bg-surface-raised text-foreground-muted border border-border-subtle">
                              <ImageIcon className="size-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {row.templateName}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                                  row.templateKind === "ocb"
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                    : "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                                )}
                              >
                                {row.templateKind.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-foreground-muted uppercase">
                                {row.network}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Granter Admin */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {row.granterName}
                        </p>
                        {row.granterEmail ? (
                          <p className="text-[11px] text-foreground-muted">
                            {row.granterEmail}
                          </p>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {row.status === "minted" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            {t("manualMint.history.statusMinted")}
                          </span>
                        ) : row.status === "pending" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="size-3" />
                            {t("manualMint.history.statusPending")}
                          </span>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="inline-flex cursor-help items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                                <AlertCircle className="size-3" />
                                <span>{t("manualMint.history.statusFailed")}</span>
                              </TooltipTrigger>
                              {row.errorMessage ? (
                                <TooltipContent>
                                  <p className="max-w-xs text-xs">
                                    {row.errorMessage}
                                  </p>
                                </TooltipContent>
                              ) : null}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="max-w-[160px] px-4 py-3">
                        <p className="truncate text-foreground-muted">
                          {row.grantedReason || "-"}
                        </p>
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">
                        {formatDate(row.mintedAt || row.createdAt)}
                      </td>

                      {/* Actions / Explorer */}
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {row.explorerUrl ? (
                          <a
                            href={row.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            <ExternalLink className="size-3" />
                            <span>{t("manualMint.history.viewOnOpenCampus")}</span>
                          </a>
                        ) : (
                          <span className="text-foreground-muted text-[11px]">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
