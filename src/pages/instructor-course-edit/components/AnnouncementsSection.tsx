import { useMemo, useState } from "react";
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
import { AnnouncementBodyField } from "@/components/email/AnnouncementBodyField";
import { blastCourseEmail, type BlastEmailResult } from "@/lib/courseBlast";
import { announcementMessageToHtml } from "@/lib/email/announcementBody";

const SUBJECT_MAX = 200;

type Props = {
  courseId: string;
  enrollmentCount: number;
};

export function AnnouncementsSection({ courseId, enrollmentCount }: Props) {
  const { t } = useTranslation("instructor");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<BlastEmailResult | null>(null);

  const subjectValid = subject.trim().length > 0 && subject.length <= SUBJECT_MAX;
  const bodyValid = body.trim().length > 0;
  const canSend = subjectValid && bodyValid && !sending && enrollmentCount > 0;

  const recipientLabel = useMemo(() => {
    if (enrollmentCount === 0) return t("courseEdit.announcements.recipientCountZero");
    return t("courseEdit.announcements.recipientCount", { count: enrollmentCount });
  }, [enrollmentCount, t]);

  async function submitBlast() {
    setConfirmOpen(false);
    setSending(true);
    try {
      const result = await blastCourseEmail(courseId, {
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
    <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
          <Mail className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("courseEdit.announcements.heroTitle")}
          </h2>
          <p className="mt-1 text-sm text-foreground-muted">
            {t("courseEdit.announcements.heroDescription")}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5 border-t border-border-subtle pt-5">
        <p className="text-sm text-foreground-muted">{recipientLabel}</p>

        {/* Subject */}
        <div>
          <label
            htmlFor="ann-subject"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {t("courseEdit.announcements.subjectLabel")}
          </label>
          <Input
            id="ann-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("courseEdit.announcements.subjectPlaceholder")}
            maxLength={SUBJECT_MAX}
          />
          <p className={`mt-1 text-right text-xs ${subject.length > SUBJECT_MAX ? "text-destructive" : "text-foreground-muted"}`}>
            {subject.length} / {SUBJECT_MAX}
          </p>
        </div>

        <AnnouncementBodyField
          id="ann-body"
          value={body}
          onChange={setBody}
          label={t("courseEdit.announcements.bodyLabel")}
          placeholder={t("courseEdit.announcements.bodyPlaceholder")}
          hint={t("courseEdit.announcements.bodyHint")}
          previewToggleLabel={t("courseEdit.announcements.bodyPreviewToggle")}
          previewBrandedNote={t("courseEdit.announcements.bodyPreviewBrandedNote")}
        />

        {/* Last result */}
        {lastResult && (
          <div className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm">
            {lastResult.ok && lastResult.reason === "email_not_configured" ? (
              <p className="text-destructive">
                {t("courseEdit.announcements.systemUnavailable")}
              </p>
            ) : lastResult.ok ? (
              <>
                <p className="font-medium text-foreground">
                  {t("courseEdit.announcements.resultSent", {
                    sent: lastResult.sent,
                    total: lastResult.total,
                  })}
                </p>
                {lastResult.failed > 0 && (
                  <p className="mt-0.5 text-foreground-muted">
                    {t("courseEdit.announcements.resultFailed", { failed: lastResult.failed })}
                  </p>
                )}
                {lastResult.skipped > 0 && (
                  <p className="mt-0.5 text-foreground-muted">
                    {t("courseEdit.announcements.resultSkipped", { skipped: lastResult.skipped })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-destructive">
                {t("courseEdit.announcements.systemUnavailable")}
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
                  {t("courseEdit.announcements.sendButton")}
                </Button>
              }
            />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("courseEdit.announcements.confirmTitle")}</DialogTitle>
                <DialogDescription>
                  {t("courseEdit.announcements.confirmDescription", { count: enrollmentCount })}
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm">
                <span className="font-medium text-foreground">
                  {t("courseEdit.announcements.confirmSubjectLabel")}
                </span>{" "}
                <span className="text-foreground-muted">{subject.trim()}</span>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                  {t("courseEdit.announcements.cancelButton")}
                </Button>
                <Button
                  type="button"
                  disabled={sending}
                  onClick={() => void submitBlast()}
                >
                  {sending ? "…" : t("courseEdit.announcements.confirmButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </section>
  );
}
