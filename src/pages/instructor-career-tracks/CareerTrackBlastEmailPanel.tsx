import { useState } from "react";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AnnouncementBodyField,
  announcementMessageToHtml,
} from "@/components/email/AnnouncementBodyField";
import { blastCareerTrackEmail, type BlastEmailResult } from "@/lib/courseBlast";

const SUBJECT_MAX = 200;

type Props = {
  trackId: string;
};

export function CareerTrackBlastEmailPanel({ trackId }: Props) {
  const { t } = useTranslation("instructor");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<BlastEmailResult | null>(null);

  const subjectValid = subject.trim().length > 0 && subject.length <= SUBJECT_MAX;
  const bodyValid = body.trim().length > 0;
  const canSend = subjectValid && bodyValid && !sending;

  async function submitBlast() {
    setConfirmOpen(false);
    setSending(true);
    try {
      const result = await blastCareerTrackEmail(trackId, {
        subject: subject.trim(),
        html: announcementMessageToHtml(body),
      });
      setLastResult(result);
    } catch (e) {
      setLastResult({
        ok: false,
        sent: 0,
        failed: 0,
        skipped: 0,
        total: 0,
        reason: e instanceof Error ? e.message : "unknown_error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
          <Mail className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("careerTracks.announcements.heroTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-foreground-muted">
            {t("careerTracks.announcements.heroDescription")}
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="track-ann-subject"
          className="mb-1.5 block text-sm font-medium text-foreground"
        >
          {t("careerTracks.announcements.subjectLabel")}
        </label>
        <Input
          id="track-ann-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("careerTracks.announcements.subjectPlaceholder")}
          maxLength={SUBJECT_MAX}
        />
        <p className={`mt-1 text-right text-xs ${subject.length > SUBJECT_MAX ? "text-destructive" : "text-foreground-muted"}`}>
          {subject.length} / {SUBJECT_MAX}
        </p>
      </div>

      <AnnouncementBodyField
        id="track-ann-body"
        value={body}
        onChange={setBody}
        label={t("careerTracks.announcements.bodyLabel")}
        placeholder={t("careerTracks.announcements.bodyPlaceholder")}
        hint={t("careerTracks.announcements.bodyHint")}
        previewToggleLabel={t("careerTracks.announcements.bodyPreviewToggle")}
        previewBrandedNote={t("careerTracks.announcements.bodyPreviewBrandedNote")}
        rows={8}
      />

      {lastResult && (
        <div className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm">
          {lastResult.ok ? (
            <>
              <p className="font-medium text-foreground">
                {t("careerTracks.announcements.resultSent", {
                  sent: lastResult.sent,
                  total: lastResult.total,
                })}
              </p>
              {lastResult.failed > 0 && (
                <p className="mt-0.5 text-foreground-muted">
                  {t("careerTracks.announcements.resultFailed", { failed: lastResult.failed })}
                </p>
              )}
            </>
          ) : (
            <p className="text-destructive">
              {lastResult.reason === "email_not_configured"
                ? t("careerTracks.announcements.notConfigured")
                : t("careerTracks.announcements.resultError", { reason: lastResult.reason ?? "unknown" })}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger
            render={
              <Button type="button" disabled={!canSend}>
                <Mail className="size-4" aria-hidden />
                {t("careerTracks.announcements.sendButton")}
              </Button>
            }
          />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("careerTracks.announcements.confirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("careerTracks.announcements.confirmDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm">
              <span className="font-medium text-foreground">
                {t("careerTracks.announcements.confirmSubjectLabel")}
              </span>{" "}
              <span className="text-foreground-muted">{subject.trim()}</span>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                {t("careerTracks.announcements.cancelButton")}
              </Button>
              <Button
                type="button"
                disabled={sending}
                onClick={() => void submitBlast()}
              >
                {sending ? "…" : t("careerTracks.announcements.confirmButton")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
