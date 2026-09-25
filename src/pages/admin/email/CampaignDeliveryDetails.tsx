import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { emailAdmin, type Paginated } from "@/lib/emailCenter";

type Recipient = {
  id: string;
  recipient_email: string;
  status: string;
  first_dispatched_at: string | null;
  updated_at: string;
  provider_message_id: string | null;
  last_error: string | null;
};

const sentStatuses = new Set(["accepted", "delivered", "bounced", "complained"]);
const filters = ["", "accepted", "delivered", "queued", "failed", "bounced", "indeterminate"];

function localTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "—";
}

export function CampaignDeliveryDetails({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation("emailCenter");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const recipients = useQuery({
    queryKey: ["email-center", "campaign-recipients", campaignId, status, page],
    queryFn: () => emailAdmin<Paginated<Recipient>>("campaigns.recipients", { campaign_id: campaignId, status, page }),
    refetchInterval: 5000,
    meta: { showInGlobalLoading: false },
  });
  return <div className="border-t border-border-subtle bg-surface-base p-4">
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{t("campaigns.deliveryDetails")}</span>
      <select className="h-9 rounded-md border border-border-subtle bg-surface-base px-2 text-sm" aria-label={t("campaigns.filterStatus")} value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
        {filters.map((filter) => <option key={filter} value={filter}>{filter ? t(`campaigns.status.${filter}`, { defaultValue: filter }) : t("campaigns.allStatuses")}</option>)}
      </select>
      <span className="text-xs text-foreground-muted">{t("campaigns.matchingRecipients", { count: recipients.data?.total ?? 0 })}</span>
    </div>
    {recipients.isError && <p className="text-sm text-destructive">{t("campaigns.recipientsFailed")}</p>}
    {recipients.isLoading && <p className="text-sm text-foreground-muted">{t("loading")}</p>}
    {recipients.data && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border-subtle text-foreground-muted"><th className="px-2 py-2">Email</th><th className="px-2 py-2">{t("campaigns.deliveryStatus")}</th><th className="px-2 py-2">{t("campaigns.firstDispatched")}</th><th className="px-2 py-2">{t("campaigns.providerId")}</th></tr></thead><tbody>{recipients.data.items.map((item) => <tr key={item.id} className="border-b border-border-subtle"><td className="px-2 py-2">{item.recipient_email}</td><td className="px-2 py-2">{t(`campaigns.status.${item.status}`, { defaultValue: item.status })}{item.last_error ? <span className="block text-xs text-destructive">{item.last_error}</span> : null}</td><td className="px-2 py-2">{sentStatuses.has(item.status) || item.first_dispatched_at ? localTime(item.first_dispatched_at) : "—"}</td><td className="px-2 py-2 font-mono text-xs">{item.provider_message_id ?? "—"}</td></tr>)}</tbody></table>{!recipients.data.items.length && <p className="p-3 text-sm text-foreground-muted">{t("empty")}</p>}</div>}
    {(recipients.data?.total ?? 0) > 50 && <div className="mt-3 flex items-center justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{t("previous")}</Button><span className="text-sm">{page + 1}</span><Button type="button" size="sm" variant="outline" disabled={(page + 1) * 50 >= (recipients.data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>{t("next")}</Button></div>}
  </div>;
}
