import { useState } from "react";
import { Eye, EyeOff, Mail } from "lucide-react";
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
import { blastCareerTrackEmail, type BlastEmailResult } from "@/lib/courseBlast";

const SUBJECT_MAX = 200;

type Props = {
  trackId: string;
};

export function CareerTrackBlastEmailPanel({ trackId }: Props) {
  const { t } = useTranslation("instructor");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
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
        html: body.trim(),
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

      {/* Subject */}
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

      {/* Body */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="track-ann-body" className="text-sm font-medium text-foreground">
            {t("careerTracks.announcements.bodyLabel")}
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1.5 px-2 py-1 text-xs text-foreground-muted hover:text-foreground"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
            {t("careerTracks.announcements.bodyPreviewToggle")}
          </Button>
        </div>
        <textarea
          id="track-ann-body"
          rows={8}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("careerTracks.announcements.bodyPlaceholder")}
          className="w-full rounded-md border border-border bg-surface-base px-3 py-2 font-mono text-xs text-foreground outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
        />
        {showPreview && body.trim() && (
          <div
            className="mt-3 min-h-20 rounded-md border border-border-subtle bg-white px-5 py-4 text-sm text-gray-900 shadow-inner"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
      </div>

      {/* Last result */}
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

      {/* Send button + confirm dialog */}
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
