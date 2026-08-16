import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FilterX,
  ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import {
  listManualMintHistoryForAdmin,
  retryManualGrant,
  revokeManualGrant,
  type ManualMintHistoryRow,
} from "@/lib/manualMintHistory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "minted" | "pending" | "failed";
type KindFilter = "all" | "oca" | "ocb";
type DateFilter = "all" | "today" | "7days" | "30days" | "this_month";

function matchesDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const date = new Date(dateStr);
  const now = new Date();

  if (filter === "today") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }
  if (filter === "7days") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return date >= sevenDaysAgo;
  }
  if (filter === "30days") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return date >= thirtyDaysAgo;
  }
  if (filter === "this_month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }
  return true;
}

export function ManualMintHistoryTable() {
  const { t } = useTranslation("admin");
  const [rows, setRows] = useState<ManualMintHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await listManualMintHistoryForAdmin();
      setRows(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("manualMint.history.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const counts = useMemo(() => {
    return {
      all: rows.length,
      minted: rows.filter((r) => r.status === "minted").length,
      pending: rows.filter(
        (r) => r.status === "pending" || r.status === "awaiting_signup",
      ).length,
      failed: rows.filter((r) => r.status === "failed").length,
    };
  }, [rows]);

  const handleRevoke = async (item: ManualMintHistoryRow) => {
    const targetLabel = item.recipientEmail || item.recipientName;
    const confirmed = window.confirm(
      t("manualMint.history.revokeConfirm", {
        recipient: targetLabel,
        defaultValue: `Thu hồi lượt cấp này cho "${targetLabel}"? Hành động này không thể hoàn tác.`,
      }),
    );
    if (!confirmed) return;

    setRevokingId(item.id);
    try {
      await revokeManualGrant(item.id, item.isGhost);
      toast.success(t("manualMint.history.revokeSuccess"));
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("manualMint.history.revokeFailed"),
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleRetry = async (item: ManualMintHistoryRow) => {
    setRetryingId(item.id);
    try {
      const res = await retryManualGrant(item.id);
      if (res && res.status === "minted") {
        toast.success(t("manualMint.history.retrySuccess"));
      } else if (res && res.status === "pending") {
        toast.success(t("manualMint.history.retrySuccess"));
      } else {
        toast.error(
          (res && res.message) || t("manualMint.history.retryFailed"),
        );
      }
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("manualMint.history.retryFailed"),
      );
      await loadData();
    } finally {
      setRetryingId(null);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "all" ||
    kindFilter !== "all" ||
    dateFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setKindFilter("all");
    setDateFilter("all");
  };

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rows.filter((row) => {
      // 1. Status filter
      if (statusFilter === "minted" && row.status !== "minted") return false;
      if (
        statusFilter === "pending" &&
        row.status !== "pending" &&
        row.status !== "awaiting_signup"
      ) {
        return false;
      }
      if (statusFilter === "failed" && row.status !== "failed") return false;

      // 2. Kind filter
      if (kindFilter !== "all" && row.templateKind !== kindFilter) return false;

      // 3. Date filter
      if (!matchesDateFilter(row.mintedAt || row.createdAt, dateFilter)) {
        return false;
      }

      // 4. Search query
      if (q) {
        const matchName = row.recipientName.toLowerCase().includes(q);
        const matchEmail = row.recipientEmail.toLowerCase().includes(q);
        const matchOcid = row.recipientOcid?.toLowerCase().includes(q) ?? false;
        const matchTemplate = row.templateName.toLowerCase().includes(q);
        const matchReason =
          row.grantedReason?.toLowerCase().includes(q) ?? false;
        const matchGranter =
          row.granterName?.toLowerCase().includes(q) ?? false;
        const matchGranterEmail =
          row.granterEmail?.toLowerCase().includes(q) ?? false;

        if (
          !matchName &&
          !matchEmail &&
          !matchOcid &&
          !matchTemplate &&
          !matchReason &&
          !matchGranter &&
          !matchGranterEmail
        ) {
          return false;
        }
      }

      return true;
    });
  }, [rows, searchQuery, statusFilter, kindFilter, dateFilter]);

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Quick Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            statusFilter === "all"
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "bg-surface-raised/60 text-foreground-muted hover:bg-surface-raised hover:text-foreground",
          )}
        >
          <span>{t("manualMint.history.filterStatusAll")}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px]",
              statusFilter === "all"
                ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                : "bg-surface-base text-foreground-muted",
            )}
          >
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("minted")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            statusFilter === "minted"
              ? "bg-emerald-600 text-white font-semibold shadow-xs"
              : "bg-surface-raised/60 text-foreground-muted hover:bg-surface-raised hover:text-foreground",
          )}
        >
          <CheckCircle2 className="size-3.5" />
          <span>{t("manualMint.history.statusMinted")}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px]",
              statusFilter === "minted"
                ? "bg-white/20 text-white font-bold"
                : "bg-surface-base text-foreground-muted",
            )}
          >
            {counts.minted}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("pending")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            statusFilter === "pending"
              ? "bg-yellow-400 text-neutral-950 font-bold shadow-xs"
              : "bg-surface-raised/60 text-foreground-muted hover:bg-surface-raised hover:text-foreground",
          )}
        >
          <Clock className="size-3.5" />
          <span>{t("manualMint.history.statusPending")}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px]",
              statusFilter === "pending"
                ? "bg-neutral-950/20 text-neutral-950 font-bold"
                : "bg-surface-base text-foreground-muted",
            )}
          >
            {counts.pending}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("failed")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            statusFilter === "failed"
              ? "bg-destructive text-destructive-foreground font-semibold shadow-xs"
              : "bg-surface-raised/60 text-foreground-muted hover:bg-surface-raised hover:text-foreground",
          )}
        >
          <AlertCircle className="size-3.5" />
          <span>{t("manualMint.history.statusFailed")}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.2 text-[10px]",
              statusFilter === "failed"
                ? "bg-destructive-foreground/20 text-destructive-foreground font-bold"
                : "bg-surface-base text-foreground-muted",
            )}
          >
            {counts.failed}
          </span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-surface-base p-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("manualMint.history.searchPlaceholder")}
            className="pl-9 text-xs h-8.5 bg-surface-raised/40"
          />
        </div>

        {/* Right: Dropdowns & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Kind Filter */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-foreground-muted font-medium whitespace-nowrap">
              {t("manualMint.history.kindFilterLabel")}:
            </span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as KindFilter)}
              className="h-8.5 rounded-md border border-border-subtle bg-surface-base px-2 text-xs text-foreground outline-none focus-visible:border-primary cursor-pointer"
            >
              <option value="all">{t("manualMint.history.filterKindAll")}</option>
              <option value="oca">{t("manualMint.history.filterKindOca")}</option>
              <option value="ocb">{t("manualMint.history.filterKindOcb")}</option>
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1">
            <Calendar className="size-3.5 text-foreground-muted" />
            <span className="text-xs text-foreground-muted font-medium whitespace-nowrap">
              {t("manualMint.history.dateFilterLabel")}:
            </span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="h-8.5 rounded-md border border-border-subtle bg-surface-base px-2 text-xs text-foreground outline-none focus-visible:border-primary cursor-pointer"
            >
              <option value="all">{t("manualMint.history.filterDateAll")}</option>
              <option value="today">{t("manualMint.history.filterDateToday")}</option>
              <option value="7days">{t("manualMint.history.filterDate7Days")}</option>
              <option value="30days">{t("manualMint.history.filterDate30Days")}</option>
              <option value="this_month">{t("manualMint.history.filterDateThisMonth")}</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8.5 px-2 text-xs text-foreground-muted hover:text-foreground cursor-pointer"
            >
              <FilterX className="mr-1 size-3.5" />
              {t("manualMint.history.resetFilters")}
            </Button>
          )}

          {/* Refresh button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            disabled={loading}
            className="h-8.5 px-2.5 text-xs cursor-pointer"
          >
            <RefreshCw
              className={cn("size-3.5", loading && "animate-spin")}
            />
          </Button>
        </div>
      </div>

      {/* Table Container - Fluid 100% width with fixed layout (NO horizontal scroll) */}
      <div className="w-full overflow-hidden rounded-lg border border-border-subtle bg-surface-base">
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
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="mt-3 text-xs cursor-pointer"
              >
                {t("manualMint.history.resetFilters")}
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full table-fixed text-left text-xs">
            <thead className="border-b border-border-subtle bg-surface-raised/50 text-foreground-muted font-medium">
              <tr>
                <th className="w-[17%] px-3.5 py-3 font-semibold">
                  {t("manualMint.history.recipientCol")}
                </th>
                <th className="w-[38%] px-3.5 py-3 font-semibold">
                  {t("manualMint.history.badgeCol")}
                </th>
                <th className="w-[17%] px-3.5 py-3 font-semibold">
                  {t("manualMint.history.granterCol")} & {t("manualMint.history.dateCol")}
                </th>
                <th className="w-[13%] px-3 py-3 font-semibold">
                  {t("manualMint.history.statusCol")}
                </th>
                <th className="w-[15%] px-3.5 py-3 text-right font-semibold">
                  {t("manualMint.history.actionsCol")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredRows.map((row) => {
                const isPendingOrGhost =
                  row.status === "pending" ||
                  row.status === "awaiting_signup";
                const isFailed = row.status === "failed";

                return (
                  <tr
                    key={row.id}
                    className="transition-colors hover:bg-surface-raised/40"
                  >
                    {/* Cột 1: Người nhận */}
                    <td className="px-3.5 py-3">
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "truncate font-semibold text-sm leading-tight",
                            row.isGhost
                              ? "text-yellow-500 font-medium italic"
                              : "text-foreground",
                          )}
                        >
                          {row.recipientName}
                        </p>
                        <p className="truncate text-xs text-foreground-muted mt-0.5">
                          {row.recipientEmail}
                        </p>
                        {row.recipientOcid ? (
                          <div className="mt-1">
                            <span className="inline-flex items-center rounded-full border border-border bg-primary-muted px-2 py-0.5 text-xs font-normal text-primary max-w-full truncate">
                              {row.recipientOcid.endsWith(".edu")
                                ? row.recipientOcid
                                : `${row.recipientOcid}.edu`}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Cột 2: Chứng nhận & Lý do */}
                    <td className="px-3.5 py-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {row.templateImageUrl ? (
                          <img
                            src={row.templateImageUrl}
                            alt=""
                            className="size-8 shrink-0 rounded object-contain bg-surface-raised p-0.5 border border-border-subtle mt-0.5"
                          />
                        ) : (
                          <div className="flex size-8 shrink-0 items-center justify-center rounded bg-surface-raised text-foreground-muted border border-border-subtle mt-0.5">
                            <ImageIcon className="size-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="truncate font-medium text-foreground text-sm leading-tight">
                              {row.templateName}
                            </p>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0",
                                row.templateKind === "ocb"
                                  ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20"
                                  : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                              )}
                            >
                              {row.templateKind.toUpperCase()}
                            </span>
                          </div>
                          {row.grantedReason ? (
                            <p
                              className="truncate text-xs text-foreground-muted mt-0.5"
                              title={row.grantedReason}
                            >
                              {row.grantedReason}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    {/* Cột 3: Admin cấp & Ngày */}
                    <td className="px-3.5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-sm leading-tight">
                          {row.granterName}
                        </p>
                        <p className="text-xs text-foreground-muted mt-0.5 truncate">
                          {formatDate(row.mintedAt || row.createdAt)}
                        </p>
                      </div>
                    </td>

                    {/* Cột 4: Trạng thái */}
                    <td className="px-3 py-3">
                      {row.status === "minted" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                          <CheckCircle2 className="size-3 shrink-0" />
                          {t("manualMint.history.statusMinted")}
                        </span>
                      ) : row.status === "awaiting_signup" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 text-yellow-500 dark:text-yellow-400 border border-yellow-400/30 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                          <Clock className="size-3 shrink-0" />
                          {t("manualMint.history.statusAwaitingSignup")}
                        </span>
                      ) : row.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 text-yellow-500 dark:text-yellow-400 border border-yellow-400/30 px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap">
                          <Clock className="size-3 shrink-0" />
                          {t("manualMint.history.statusPending")}
                        </span>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="inline-flex cursor-help items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive border border-destructive/20 whitespace-nowrap">
                              <AlertCircle className="size-3 shrink-0" />
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

                    {/* Cột 5: Thao tác */}
                    <td className="px-3.5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Minted: Explorer Link */}
                        {row.status === "minted" && row.explorerUrl ? (
                          <a
                            href={row.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary shrink-0"
                            title={t("manualMint.history.viewOnOpenCampus")}
                          >
                            <ExternalLink className="size-3.5" />
                            <span>Explorer</span>
                          </a>
                        ) : null}

                        {/* Failed: Thử lại (Retry) & Thu hồi (Revoke) song song */}
                        {isFailed && (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={retryingId === row.id || revokingId === row.id}
                            onClick={() => void handleRetry(row)}
                            className="h-7 px-2 text-xs font-medium text-foreground hover:bg-surface-raised shrink-0 cursor-pointer"
                            title={t("manualMint.history.retryBtn")}
                          >
                            {retryingId === row.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="size-3 mr-1" />
                                <span>{t("manualMint.history.retryBtn")}</span>
                              </>
                            )}
                          </Button>
                        )}

                        {/* Pending hoặc Failed: Thu hồi (Revoke) */}
                        {(isPendingOrGhost || isFailed) && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="xs"
                            disabled={revokingId === row.id || retryingId === row.id}
                            onClick={() => void handleRevoke(row)}
                            className="h-7 px-2 text-xs font-medium shrink-0 cursor-pointer"
                            title={t("manualMint.history.revokeBtn")}
                          >
                            {revokingId === row.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="size-3 mr-1" />
                                <span>{t("manualMint.history.revokeBtn")}</span>
                              </>
                            )}
                          </Button>
                        )}

                        {!row.explorerUrl && !isPendingOrGhost && !isFailed && (
                          <span className="text-foreground-muted text-xs pr-2">
                            -
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
