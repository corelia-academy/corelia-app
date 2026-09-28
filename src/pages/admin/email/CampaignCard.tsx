import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CampaignDeliveryDetails } from "./CampaignDeliveryDetails";

type Campaign = Record<string, unknown>;
type Action = "send" | "schedule" | "pause" | "resume" | "cancel";

function vietnamTime(value: unknown): string {
  return typeof value === "string" && value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(value)) : "";
}

export function CampaignCard({ campaign, pending, onControl }: { campaign: Campaign; pending: boolean; onControl: (id: string, command: string, scheduledAt?: string) => Promise<void> }) {
  const { t } = useTranslation("emailCenter");
  const [expanded, setExpanded] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [schedule, setSchedule] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const id = String(campaign.id);
  const status = String(campaign.status);
  const sender = campaign.email_senders as { display_name?: string; from_email?: string } | null;
  const version = campaign.email_templates as { subject?: string; version?: number; email_templates?: { name?: string } } | null;
  const list = campaign.email_lists as { name?: string } | null;
  const total = Number(campaign.prepared_recipients ?? 0);
  const accepted = Number(campaign.accepted_count ?? 0);
  const failed = Number(campaign.failed_count ?? 0);
  const waitingToSendNow = status === "scheduled" && Date.parse(String(campaign.scheduled_at ?? "")) <= Date.now();
  const scheduleIso = schedule ? new Date(`${schedule}:00+07:00`).toISOString() : "";
  const validSchedule = Boolean(schedule && Date.parse(scheduleIso) > Date.now());

  const confirm = async () => {
    if (!action) return;
    setSubmitting(true);
    try {
      await onControl(id, action === "send" || action === "schedule" ? "start" : action, action === "schedule" ? scheduleIso : undefined);
      setAction(null);
      setSchedule("");
    } finally { setSubmitting(false); }
  };

  return <div className="p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{String(campaign.name)}</h3><Badge color={status === "failed" ? "error" : status === "running" ? "success" : status === "scheduled" ? "warning" : "gray"}>{waitingToSendNow ? t("campaigns.waitingToSend") : t(`campaigns.status.${status}`, { defaultValue: status })}</Badge></div>
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          <div><dt className="text-foreground-muted">{t("campaigns.template")}</dt><dd>{version?.email_templates?.name ?? "—"} · v{version?.version ?? "—"}</dd></div>
          <div><dt className="text-foreground-muted">{t("campaigns.sender")}</dt><dd>{String(campaign.frozen_from || (sender ? `${sender.display_name ?? ""} <${sender.from_email ?? ""}>` : "—"))}</dd></div>
          <div><dt className="text-foreground-muted">{t("campaigns.list")}</dt><dd>{campaign.audience_type === "all_contacts" ? t("campaigns.allCurrentContactsLabel") : list?.name ?? "—"} · {total.toLocaleString()} {t("campaigns.recipients")}</dd></div>
          <div><dt className="text-foreground-muted">{t("templates.purpose")}</dt><dd>{t(`purposes.${String(campaign.purpose)}`, { defaultValue: String(campaign.purpose) })}</dd></div>
          <div className="sm:col-span-2"><dt className="text-foreground-muted">{t("campaigns.subjectPreview")}</dt><dd>{String(campaign.frozen_subject || version?.subject || "—")}</dd></div>
          <div className="sm:col-span-2"><dt className="text-foreground-muted">Reply-To</dt><dd>{String(campaign.frozen_reply_to || "—")}</dd></div>
        </dl>
        <p className="mt-3 text-xs font-medium">{waitingToSendNow ? t("campaigns.workerPending") : status === "scheduled" ? t("campaigns.scheduledFor", { time: vietnamTime(campaign.scheduled_at) }) : status === "running" ? t("campaigns.sendingProgress", { accepted, total }) : status === "ready" ? t("campaigns.notScheduled") : campaign.scheduled_at ? t("campaigns.startedAt", { time: vietnamTime(campaign.scheduled_at) }) : ""}</p>
        <p className="mt-1 text-xs text-foreground-muted">{t("campaigns.acceptedCount", { count: accepted })} · {t("campaigns.deliveredCount", { count: Number(campaign.delivered_count ?? 0) })} · {t("campaigns.failedCount", { count: failed })} · {t("campaigns.suppressedCount", { count: Number(campaign.suppressed_count ?? 0) })}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {status === "ready" && <><Button type="button" size="small" disabled={pending} onClick={() => setAction("send")}>{t("campaigns.sendNow")}</Button><Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={pending} onClick={() => setAction("schedule")}>{t("campaigns.scheduleAction")}</Button></>}
        {status === "scheduled" && <Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={pending} onClick={() => setAction("cancel")}>{waitingToSendNow ? t("campaigns.cancelSend") : t("campaigns.cancel")}</Button>}
        {status === "running" && <Button type="button" size="small" variant="cta" hierarchy="secondary" disabled={pending} onClick={() => setAction("pause")}>{t("campaigns.pause")}</Button>}
        {status === "paused" && <Button type="button" size="small" disabled={pending} onClick={() => setAction("resume")}>{t("campaigns.resume")}</Button>}
        <Button type="button" size="small" variant="cta" hierarchy="secondary" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{failed > 0 ? t("campaigns.viewFailures", { count: failed }) : t("campaigns.viewRecipients")}</Button>
      </div>
    </div>
    {expanded && <div className="mt-4"><CampaignDeliveryDetails campaignId={id} initialStatus={failed > 0 ? "failed" : ""} /></div>}
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !submitting) setAction(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{action === "cancel" && waitingToSendNow ? t("campaigns.confirmCancelSend") : t(`campaigns.confirm.${action ?? "send"}`)}</DialogTitle><DialogDescription>{t("campaigns.reviewBeforeAction")}</DialogDescription></DialogHeader>
        <div className="rounded-md border border-border-subtle p-4 text-sm"><p className="font-medium">{String(campaign.name)}</p><p>{t("campaigns.template")}: {version?.email_templates?.name ?? "—"} · v{version?.version ?? "—"}</p><p>{t("campaigns.subjectPreview")}: {String(campaign.frozen_subject || version?.subject || "—")}</p><p>{t("campaigns.sender")}: {String(campaign.frozen_from ?? "—")}</p><p>Reply-To: {String(campaign.frozen_reply_to ?? "—")}</p><p>{t("campaigns.list")}: {campaign.audience_type === "all_contacts" ? t("campaigns.allCurrentContactsLabel") : list?.name ?? "—"} · {total.toLocaleString()} {t("campaigns.recipients")}</p></div>
        {action === "schedule" && <div><Label htmlFor={`schedule-${id}`}>{t("campaigns.schedule")}</Label><Input id={`schedule-${id}`} className="mt-1" type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /><p className="mt-1 text-xs text-foreground-muted">{validSchedule ? t("campaigns.scheduledFor", { time: vietnamTime(scheduleIso) }) : t("campaigns.futureSchedule")}</p></div>}
        {action === "send" && <p className="text-sm font-medium">{t("campaigns.sendNowWarning")}</p>}
        <DialogFooter><Button type="button" variant="cta" hierarchy="secondary" onClick={() => setAction(null)}>{t("campaigns.back")}</Button><Button type="button" disabled={submitting || pending || action === "schedule" && !validSchedule} onClick={confirm}>{action === "cancel" && waitingToSendNow ? t("campaigns.confirmCancelSend") : t(`campaigns.confirm.${action ?? "send"}`)}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
