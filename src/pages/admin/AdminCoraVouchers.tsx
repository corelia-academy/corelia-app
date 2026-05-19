import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, RefreshCw, TicketPercent, Wand2 } from "lucide-react";
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
  listAiVoucherRedemptions,
  listAiVouchers,
  upsertAiVoucher,
  type AiVoucher,
  type AiVoucherRedemption,
} from "@/lib/aiVouchers";

const TEXTAREA_CLASS =
  "min-h-[88px] w-full rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15";

function generateVoucherCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = [6, 4];
  return parts
    .map((len) => {
      let out = "";
      for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
      return out;
    })
    .join("-");
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function fromDateTimeLocalValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function AdminCoraVouchers() {
  const { t } = useTranslation("admin");
  const [vouchers, setVouchers] = useState<AiVoucher[]>([]);
  const [redemptions, setRedemptions] = useState<AiVoucherRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expired" | "not_expired">("all");
  const [editing, setEditing] = useState<AiVoucher | null>(null);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [active, setActive] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [voucherRows, redemptionRows] = await Promise.all([
        listAiVouchers(),
        listAiVoucherRedemptions(),
      ]);
      setVouchers(voucherRows);
      setRedemptions(redemptionRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("coraVouchers.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const redemptionCounts = useMemo(() => {
    const now = Date.now();
    return redemptions.reduce<Record<string, { paid: number; reserved: number; released: number }>>((acc, row) => {
      const current = acc[row.voucher_id] ?? { paid: 0, reserved: 0, released: 0 };
      if (row.status === "paid") current.paid += 1;
      else if (row.status === "released") current.released += 1;
      else if (!row.reserved_until || Date.parse(row.reserved_until) > now) current.reserved += 1;
      acc[row.voucher_id] = current;
      return acc;
    }, {});
  }, [redemptions]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      if (statusFilter === "active" && !voucher.active) return false;
      if (statusFilter === "inactive" && voucher.active) return false;
      const expired = !!voucher.ends_at && Date.parse(voucher.ends_at) < now;
      if (expiryFilter === "expired" && !expired) return false;
      if (expiryFilter === "not_expired" && expired) return false;
      if (!q) return true;
      return voucher.code.toLowerCase().includes(q);
    });
  }, [expiryFilter, search, statusFilter, vouchers]);

  function resetForm() {
    setEditing(null);
    setCode(generateVoucherCode());
    setPercentOff("20");
    setStartsAt("");
    setEndsAt("");
    setMaxRedemptions("");
    setActive(true);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(voucher: AiVoucher) {
    setEditing(voucher);
    setCode(voucher.code);
    setPercentOff(String(voucher.percent_off));
    setStartsAt(toDateTimeLocalValue(voucher.starts_at));
    setEndsAt(toDateTimeLocalValue(voucher.ends_at));
    setMaxRedemptions(voucher.max_redemptions == null ? "" : String(voucher.max_redemptions));
    setActive(voucher.active);
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await upsertAiVoucher(
        {
          code,
          percent_off: Number(percentOff),
          active,
          starts_at: fromDateTimeLocalValue(startsAt),
          ends_at: fromDateTimeLocalValue(endsAt),
          max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        },
        editing?.id,
      );
      toast.success(t(editing ? "coraVouchers.updated" : "coraVouchers.created"));
      setDialogOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("coraVouchers.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t("coraVouchers.heading")}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{t("coraVouchers.subheading")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 size-4" aria-hidden />
            {t("coraVouchers.refresh")}
          </Button>
          <Button type="button" onClick={openCreate}>
            <Plus className="mr-2 size-4" aria-hidden />
            {t("coraVouchers.add")}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-xl border border-border-subtle bg-surface-base p-4 md:grid-cols-4">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("coraVouchers.filters.searchPlaceholder")}
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
        >
          <option value="all">{t("coraVouchers.filters.status.all")}</option>
          <option value="active">{t("coraVouchers.filters.status.active")}</option>
          <option value="inactive">{t("coraVouchers.filters.status.inactive")}</option>
        </select>
        <select
          value={expiryFilter}
          onChange={(event) => setExpiryFilter(event.target.value as typeof expiryFilter)}
          className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
        >
          <option value="all">{t("coraVouchers.filters.expiry.all")}</option>
          <option value="expired">{t("coraVouchers.filters.expiry.expired")}</option>
          <option value="not_expired">{t("coraVouchers.filters.expiry.notExpired")}</option>
        </select>
        <div className="rounded-md border border-dashed border-border-subtle px-3 py-2 text-sm text-foreground-muted">
          {t("coraVouchers.showing", { shown: filtered.length, total: vouchers.length })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("coraVouchers.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-foreground-muted">{t("coraVouchers.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-surface-raised">
              <tr>
                <th className="px-3 py-2">{t("coraVouchers.table.code")}</th>
                <th className="px-3 py-2">{t("coraVouchers.table.percent")}</th>
                <th className="px-3 py-2">{t("coraVouchers.table.window")}</th>
                <th className="px-3 py-2">{t("coraVouchers.table.usage")}</th>
                <th className="px-3 py-2">{t("coraVouchers.table.status")}</th>
                <th className="px-3 py-2 text-right">{t("coraVouchers.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((voucher) => {
                const counts = redemptionCounts[voucher.id] ?? { paid: 0, reserved: 0, released: 0 };
                return (
                  <tr key={voucher.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-3 py-3 font-medium">{voucher.code}</td>
                    <td className="px-3 py-3">{voucher.percent_off}%</td>
                    <td className="px-3 py-3 text-foreground-muted">
                      <div>{voucher.starts_at ? new Date(voucher.starts_at).toLocaleString() : t("coraVouchers.neverStarts")}</div>
                      <div>{voucher.ends_at ? new Date(voucher.ends_at).toLocaleString() : t("coraVouchers.noExpiry")}</div>
                    </td>
                    <td className="px-3 py-3 text-foreground-muted">
                      {t("coraVouchers.usageSummary", {
                        paid: counts.paid,
                        reserved: counts.reserved,
                        max: voucher.max_redemptions ?? "∞",
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={voucher.active ? "text-emerald-700" : "text-foreground-muted"}>
                        {voucher.active ? t("coraVouchers.active") : t("coraVouchers.inactive")}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(voucher)}>
                        {t("coraVouchers.edit")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border-subtle bg-surface-base p-4">
        <div className="mb-3 flex items-center gap-2">
          <TicketPercent className="size-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{t("coraVouchers.redemptionTitle")}</h2>
        </div>
        {redemptions.length === 0 ? (
          <p className="text-sm text-foreground-muted">{t("coraVouchers.redemptionEmpty")}</p>
        ) : (
          <div className="space-y-2">
            {redemptions.slice(0, 10).map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle px-3 py-2 text-sm">
                <div className="font-medium text-foreground">{row.payment_transaction_id}</div>
                <div className="text-foreground-muted">
                  {row.user_id.slice(0, 8)} · {row.status} · -{row.discount_amount_vnd.toLocaleString()} VND
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("coraVouchers.editTitle") : t("coraVouchers.createTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <Field>
              <FieldLabel>{t("coraVouchers.form.code")}</FieldLabel>
              <div className="flex gap-2">
                <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
                <Button type="button" variant="outline" onClick={() => setCode(generateVoucherCode())}>
                  <Wand2 className="mr-2 size-4" aria-hidden />
                  {t("coraVouchers.form.generate")}
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>{t("coraVouchers.form.percentOff")}</FieldLabel>
              <Input
                type="number"
                min={1}
                max={100}
                value={percentOff}
                onChange={(event) => setPercentOff(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("coraVouchers.form.startsAt")}</FieldLabel>
              <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVouchers.form.endsAt")}</FieldLabel>
              <Input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>{t("coraVouchers.form.maxRedemptions")}</FieldLabel>
              <Input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(event) => setMaxRedemptions(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>{t("coraVouchers.form.status")}</FieldLabel>
              <select
                value={active ? "active" : "inactive"}
                onChange={(event) => setActive(event.target.value === "active")}
                className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-sm"
              >
                <option value="active">{t("coraVouchers.active")}</option>
                <option value="inactive">{t("coraVouchers.inactive")}</option>
              </select>
            </Field>
            <div className={TEXTAREA_CLASS}>
              <p className="text-sm font-medium text-foreground">{t("coraVouchers.form.noteTitle")}</p>
              <p className="mt-1 text-sm text-foreground-muted">{t("coraVouchers.form.noteBody")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("coraVouchers.cancel")}
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  {t("coraVouchers.saving")}
                </>
              ) : (
                t("coraVouchers.save")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
