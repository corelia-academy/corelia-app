import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Check,
  Copy,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  TicketPercent,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createAiVoucherBatch,
  listAiVoucherBatches,
  listAiVoucherCodes,
  listAiVoucherRedemptions,
  setAiVoucherCodeActive,
  updateAiVoucherBatch,
  type AiVoucherBatch,
  type AiVoucherBatchCreateResult,
  type AiVoucherCode,
  type AiVoucherRedemption,
} from "@/lib/aiVouchers";

function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type BatchStats = {
  available: number;
  reserved: number;
  paid: number;
  inactive: number;
};

export default function AdminCoraVouchers() {
  const { t } = useTranslation("admin");
  const [batches, setBatches] = useState<AiVoucherBatch[]>([]);
  const [codesByBatch, setCodesByBatch] = useState<Record<string, AiVoucherCode[]>>({});
  const [redemptions, setRedemptions] = useState<AiVoucherRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "not_expired">("all");
  const [codeFilter, setCodeFilter] = useState<"all" | "available" | "reserved" | "paid" | "inactive">("all");
  const [createdResult, setCreatedResult] = useState<AiVoucherBatchCreateResult | null>(null);
  const [form, setForm] = useState({
    name: "",
    quantity: "10",
    codePrefix: "",
    percentOff: "20",
    startsAt: "",
    endsAt: "",
    active: true,
    targetTier: "" as "" | "student" | "pro" | "bootcamp",
    targetDurationMonths: "" as "" | "1" | "12",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRows, redemptionRows] = await Promise.all([
        listAiVoucherBatches(),
        listAiVoucherRedemptions(),
      ]);
      const codeEntries = await Promise.all(
        batchRows.map(async (batch) => [batch.id, await listAiVoucherCodes(batch.id)] as const),
      );
      setBatches(batchRows);
      setCodesByBatch(Object.fromEntries(codeEntries));
      setRedemptions(redemptionRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("coraVoucherBatches.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const voucherRedemptionMap = useMemo(() => {
    const nowIso = new Date().toISOString();
    return redemptions.reduce<Record<string, "available" | "reserved" | "paid">>((acc, row) => {
      if (row.status === "paid") acc[row.voucher_id] = "paid";
      else if (row.status === "reserved" && row.reserved_until && row.reserved_until > nowIso && acc[row.voucher_id] !== "paid") {
        acc[row.voucher_id] = "reserved";
      }
      return acc;
    }, {});
  }, [redemptions]);

  const batchStats = useMemo(() => {
    return Object.fromEntries(
      batches.map((batch) => {
        const stats: BatchStats = { available: 0, reserved: 0, paid: 0, inactive: 0 };
        for (const code of codesByBatch[batch.id] ?? []) {
          if (!code.active) {
            stats.inactive += 1;
            continue;
          }
          const status = voucherRedemptionMap[code.id] ?? "available";
          stats[status] += 1;
        }
        return [batch.id, stats];
      }),
    ) as Record<string, BatchStats>;
  }, [batches, codesByBatch, voucherRedemptionMap]);

  const filteredBatches = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return batches.filter((batch) => {
      if (statusFilter === "active" && !batch.active) return false;
      if (statusFilter === "inactive" && batch.active) return false;
      const expired = !!batch.ends_at && Date.parse(batch.ends_at) < now;
      if (expiryFilter === "expired" && !expired) return false;
      if (expiryFilter === "not_expired" && expired) return false;
      if (!q) return true;
      return batch.name.toLowerCase().includes(q);
    });
  }, [batches, expiryFilter, search, statusFilter]);

  const detailBatch = detailBatchId ? batches.find((batch) => batch.id === detailBatchId) ?? null : null;
  const detailCodes = useMemo(() => {
    if (!detailBatchId) return [];
    return (codesByBatch[detailBatchId] ?? []).filter((code) => {
      const status = !code.active ? "inactive" : (voucherRedemptionMap[code.id] ?? "available");
      return codeFilter === "all" ? true : status === codeFilter;
    });
  }, [codeFilter, codesByBatch, detailBatchId, voucherRedemptionMap]);

  function resetCreateForm() {
    setForm({
      name: "",
      quantity: "10",
      codePrefix: "",
      percentOff: "20",
      startsAt: "",
      endsAt: "",
      active: true,
      targetTier: "",
      targetDurationMonths: "",
    });
    setCreatedResult(null);
  }

  async function handleCreateBatch() {
    setSaving(true);
    try {
      const result = await createAiVoucherBatch({
        name: form.name,
        quantity: Number(form.quantity),
        codePrefix: form.codePrefix.trim() || undefined,
        percentOff: Number(form.percentOff),
        startsAt: fromDateTimeLocalValue(form.startsAt),
        endsAt: fromDateTimeLocalValue(form.endsAt),
        active: form.active,
        targetTier: form.targetTier || null,
        targetDurationMonths: form.targetDurationMonths ? (Number(form.targetDurationMonths) as 1 | 12) : null,
      });
      setCreatedResult(result);
      toast.success(t("coraVoucherBatches.created"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("coraVoucherBatches.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCode(code: AiVoucherCode) {
    try {
      await setAiVoucherCodeActive(code.id, !code.active);
      toast.success(t("coraVoucherBatches.codeUpdated"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("coraVoucherBatches.saveFailed"));
    }
  }

  async function handleToggleBatch(batch: AiVoucherBatch) {
    try {
      await updateAiVoucherBatch(batch.id, { active: !batch.active });
      toast.success(t("coraVoucherBatches.batchUpdated"));
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("coraVoucherBatches.saveFailed"));
    }
  }

  async function copyCodes(codes: AiVoucherCode[]) {
    try {
      await navigator.clipboard.writeText(codes.map((code) => code.code).join("\n"));
      toast.success(t("coraVoucherBatches.codesCopied"));
    } catch {
      toast.error(t("coraVoucherBatches.copyFailed"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("coraVoucherBatches.heading")}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t("coraVoucherBatches.subheading")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 size-4" aria-hidden />
            {t("coraVoucherBatches.refresh")}
          </Button>
          <Button type="button" onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
            <Plus className="mr-2 size-4" aria-hidden />
            {t("coraVoucherBatches.add")}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 md:grid-cols-4">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("coraVoucherBatches.filters.searchPlaceholder")} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
        >
          <option value="all">{t("coraVoucherBatches.filters.status.all")}</option>
          <option value="active">{t("coraVoucherBatches.filters.status.active")}</option>
          <option value="inactive">{t("coraVoucherBatches.filters.status.inactive")}</option>
        </select>
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value as typeof expiryFilter)}
          className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
        >
          <option value="all">{t("coraVoucherBatches.filters.expiry.all")}</option>
          <option value="expired">{t("coraVoucherBatches.filters.expiry.expired")}</option>
          <option value="not_expired">{t("coraVoucherBatches.filters.expiry.notExpired")}</option>
        </select>
        <div className="rounded-md border border-dashed border-border-subtle px-3 py-2 text-sm text-foreground-muted">
          {t("coraVoucherBatches.showing", { shown: filteredBatches.length, total: batches.length })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("coraVoucherBatches.loading")}
        </div>
      ) : filteredBatches.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("coraVoucherBatches.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-surface-raised">
              <tr>
                <th className="px-3 py-2">{t("coraVoucherBatches.table.name")}</th>
                <th className="px-3 py-2">{t("coraVoucherBatches.table.percent")}</th>
                <th className="px-3 py-2">{t("coraVoucherBatches.table.window")}</th>
                <th className="px-3 py-2">{t("coraVoucherBatches.table.counts")}</th>
                <th className="px-3 py-2">{t("coraVoucherBatches.table.status")}</th>
                <th className="px-3 py-2 text-right">{t("coraVoucherBatches.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => {
                const stats = batchStats[batch.id] ?? { available: 0, reserved: 0, paid: 0, inactive: 0 };
                return (
                  <tr key={batch.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-3 py-3 font-medium">{batch.name}</td>
                    <td className="px-3 py-3">
                      <div>{batch.percent_off}%</div>
                      {(batch.target_tier || batch.target_duration_months) && (
                        <div className="mt-0.5 text-xs text-foreground-muted">
                          {[
                            batch.target_tier ? t(`coraVoucherBatches.tiers.${batch.target_tier}`) : null,
                            batch.target_duration_months ? t(`coraVoucherBatches.durations.${batch.target_duration_months}`) : null,
                          ].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-foreground-muted">
                      <div>{batch.starts_at ? new Date(batch.starts_at).toLocaleString() : t("coraVoucherBatches.neverStarts")}</div>
                      <div>{batch.ends_at ? new Date(batch.ends_at).toLocaleString() : t("coraVoucherBatches.noExpiry")}</div>
                    </td>
                    <td className="px-3 py-3 text-foreground-muted">
                      {t("coraVoucherBatches.counts", stats)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={batch.active ? "text-emerald-700" : "text-foreground-muted"}>
                        {batch.active ? t("coraVoucherBatches.active") : t("coraVoucherBatches.inactive")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setDetailBatchId(batch.id)}>
                          {t("coraVoucherBatches.viewCodes")}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleToggleBatch(batch)}>
                          {batch.active ? t("coraVoucherBatches.deactivate") : t("coraVoucherBatches.activate")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("coraVoucherBatches.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.name")}</FieldLabel>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.quantity")}</FieldLabel>
              <Input type="number" min={1} max={1000} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.codePrefix")}</FieldLabel>
              <Input value={form.codePrefix} onChange={(e) => setForm((p) => ({ ...p, codePrefix: e.target.value.toUpperCase() }))} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.percentOff")}</FieldLabel>
              <Input type="number" min={1} max={100} value={form.percentOff} onChange={(e) => setForm((p) => ({ ...p, percentOff: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.targetTier")}</FieldLabel>
              <select
                value={form.targetTier}
                onChange={(e) => setForm((p) => ({ ...p, targetTier: e.target.value as typeof form.targetTier }))}
                className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
              >
                <option value="">{t("coraVoucherBatches.form.targetTierAny")}</option>
                <option value="student">{t("coraVoucherBatches.tiers.student")}</option>
                <option value="pro">{t("coraVoucherBatches.tiers.pro")}</option>
                <option value="bootcamp">{t("coraVoucherBatches.tiers.bootcamp")}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.targetDuration")}</FieldLabel>
              <select
                value={form.targetDurationMonths}
                onChange={(e) => setForm((p) => ({ ...p, targetDurationMonths: e.target.value as typeof form.targetDurationMonths }))}
                className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
              >
                <option value="">{t("coraVoucherBatches.form.targetDurationAny")}</option>
                <option value="1">{t("coraVoucherBatches.durations.1")}</option>
                <option value="12">{t("coraVoucherBatches.durations.12")}</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.startsAt")}</FieldLabel>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVoucherBatches.form.endsAt")}</FieldLabel>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))} />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel>{t("coraVoucherBatches.form.status")}</FieldLabel>
              <select
                value={form.active ? "active" : "inactive"}
                onChange={(e) => setForm((p) => ({ ...p, active: e.target.value === "active" }))}
                className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
              >
                <option value="active">{t("coraVoucherBatches.active")}</option>
                <option value="inactive">{t("coraVoucherBatches.inactive")}</option>
              </select>
            </Field>
          </div>

          {createdResult ? (
            <div className="rounded-xl border border-success/20 bg-success/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <Check className="size-4" aria-hidden />
                {t("coraVoucherBatches.createdBatchReady", { count: createdResult.codes.length })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void copyCodes(createdResult.codes)}>
                  <Copy className="mr-2 size-4" aria-hidden />
                  {t("coraVoucherBatches.copyCodes")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadTextFile(`${createdResult.batch.name}.csv`, createdResult.csvText)}
                >
                  <Download className="mr-2 size-4" aria-hidden />
                  {t("coraVoucherBatches.downloadCsv")}
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t("coraVoucherBatches.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleCreateBatch()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t("coraVoucherBatches.saving")}
                </>
              ) : (
                t("coraVoucherBatches.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailBatch} onOpenChange={(open) => !open && setDetailBatchId(null)}>
        <DialogContent className="max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailBatch?.name ?? t("coraVoucherBatches.detailTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <TicketPercent className="size-4 text-primary" aria-hidden />
            <span className="text-sm text-foreground-muted">
              {detailBatch ? `${detailBatch.percent_off}%` : ""}
            </span>
            <select
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value as typeof codeFilter)}
              className="ml-auto h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
            >
              <option value="all">{t("coraVoucherBatches.codeFilters.all")}</option>
              <option value="available">{t("coraVoucherBatches.codeFilters.available")}</option>
              <option value="reserved">{t("coraVoucherBatches.codeFilters.reserved")}</option>
              <option value="paid">{t("coraVoucherBatches.codeFilters.paid")}</option>
              <option value="inactive">{t("coraVoucherBatches.codeFilters.inactive")}</option>
            </select>
            <Button type="button" variant="outline" onClick={() => void copyCodes(detailCodes)}>
              <Copy className="mr-2 size-4" aria-hidden />
              {t("coraVoucherBatches.copyCodes")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadTextFile(`${detailBatch?.name ?? "batch"}.csv`, ["code", ...detailCodes.map((code) => code.code)].join("\n"))}
            >
              <Download className="mr-2 size-4" aria-hidden />
              {t("coraVoucherBatches.downloadCsv")}
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-subtle bg-surface-raised">
                <tr>
                  <th className="px-3 py-2">{t("coraVoucherBatches.codesTable.code")}</th>
                  <th className="px-3 py-2">{t("coraVoucherBatches.codesTable.status")}</th>
                  <th className="px-3 py-2">{t("coraVoucherBatches.codesTable.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {detailCodes.map((code) => {
                  const status = !code.active ? "inactive" : (voucherRedemptionMap[code.id] ?? "available");
                  return (
                    <tr key={code.id} className="border-b border-border-subtle last:border-0">
                      <td className="px-3 py-3 font-medium">{code.code}</td>
                      <td className="px-3 py-3 text-foreground-muted">{t(`coraVoucherBatches.codeFilters.${status}`)}</td>
                      <td className="px-3 py-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleToggleCode(code)}>
                          {code.active ? t("coraVoucherBatches.deactivate") : t("coraVoucherBatches.activate")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
