import { useState, useMemo } from "react";
import { Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import type { BlastEmailFilter } from "@/lib/hackathons";

const SUBJECT_MAX = 200;

type FilterOption = {
  id: BlastEmailFilter;
  labelKey: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { id: "all", labelKey: "workspace.email.filterAll" },
  { id: "approved", labelKey: "workspace.email.filterApproved" },
  { id: "pending", labelKey: "workspace.email.filterPending" },
  { id: "rejected", labelKey: "workspace.email.filterRejected" },
];

export function ContestDetailBlastEmailPanel({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    isManageView,
    isManager,
    activeManageSection,
    registrations,
    blasting,
    handleBlastEmail,
  } = vm;

  const [recipientFilter, setRecipientFilter] = useState<BlastEmailFilter>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
    total: number;
    reason?: string;
  } | null>(null);

  const recipientCount = useMemo(() => {
    if (recipientFilter === "all") return registrations.length;
    return registrations.filter((r) => r.status === recipientFilter).length;
  }, [registrations, recipientFilter]);

  const subjectValid = subject.trim().length > 0 && subject.length <= SUBJECT_MAX;
  const bodyValid = body.trim().length > 0;
  const canSend = subjectValid && bodyValid && !blasting;

  if (!isManageView || !isManager || activeManageSection !== "email") {
    return null;
  }

  async function submitBlast() {
    setConfirmOpen(false);
    const result = await handleBlastEmail({
      subject: subject.trim(),
      html: body.trim(),
      recipientFilter,
    });
    if (result) setLastResult(result);
  }

  return (
    <Card id="email">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary" aria-hidden>
            <Mail className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {translate("workspace.email.heroTitle")}
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              {translate("workspace.email.heroDescription")}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5 border-t border-border-subtle pt-5">
          {/* Recipient filter */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              {translate("workspace.email.recipientFilterLabel")}
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={translate("workspace.email.recipientFilterLabel")}
            >
              {FILTER_OPTIONS.map((opt) => {
                const count =
                  opt.id === "all"
                    ? registrations.length
                    : registrations.filter((r) => r.status === opt.id).length;
                return (
                  <Button
                    key={opt.id}
                    type="button"
                    size="sm"
                    variant={recipientFilter === opt.id ? "default" : "outline"}
                    onClick={() => setRecipientFilter(opt.id)}
                  >
                    {translate(opt.labelKey)} ({count})
                  </Button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
              {recipientCount > 0
                ? translate("workspace.email.recipientCount", { count: recipientCount })
                : translate("workspace.email.recipientCountZero")}
            </p>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="blast-subject"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              {translate("workspace.email.subjectLabel")}
            </label>
            <Input
              id="blast-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={translate("workspace.email.subjectPlaceholder")}
              maxLength={SUBJECT_MAX}
              aria-describedby="blast-subject-hint"
            />
            <p
              id="blast-subject-hint"
              className={`mt-1 text-right text-xs ${subject.length > SUBJECT_MAX ? "text-destructive" : "text-foreground-muted"}`}
            >
              {subject.length} / {SUBJECT_MAX}
            </p>
          </div>

          {/* Body */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="blast-body"
                className="text-sm font-medium text-foreground"
              >
                {translate("workspace.email.bodyLabel")}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto gap-1.5 px-2 py-1 text-xs text-foreground-muted hover:text-foreground"
                onClick={() => setShowPreview((v) => !v)}
                aria-pressed={showPreview}
              >
                {showPreview ? (
                  <EyeOff className="size-3.5" aria-hidden />
                ) : (
                  <Eye className="size-3.5" aria-hidden />
                )}
                {translate("workspace.email.bodyPreviewToggle")}
              </Button>
            </div>
            <textarea
              id="blast-body"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={translate("workspace.email.bodyPlaceholder")}
              className="w-full rounded-md border border-border bg-surface-base px-3 py-2 font-mono text-xs text-foreground outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            />

            {showPreview && body.trim() && (
              <div
                className="mt-3 min-h-24 rounded-md border border-border-subtle bg-white px-5 py-4 text-sm text-gray-900 shadow-inner"
                aria-label={translate("workspace.email.bodyPreviewToggle")}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </div>

          {/* Last result */}
          {lastResult && (
            <div className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                {translate("workspace.email.resultSent", {
                  sent: lastResult.sent,
                  total: lastResult.total,
                })}
              </p>
              {lastResult.failed > 0 && (
                <p className="mt-0.5 text-foreground-muted">
                  {translate("workspace.email.resultFailed", { failed: lastResult.failed })}
                </p>
              )}
              {lastResult.skipped > 0 && (
                <p className="mt-0.5 text-foreground-muted">
                  {translate("workspace.email.resultSkipped", { skipped: lastResult.skipped })}
                </p>
              )}
              {lastResult.reason === "email_not_configured" && (
                <p className="mt-0.5 text-amber-600">
                  {translate("workspace.email.notConfigured")}
                </p>
              )}
            </div>
          )}

          {/* Send */}
          <div className="flex justify-end">
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    disabled={!canSend || recipientCount === 0}
                  >
                    <Mail className="size-4" aria-hidden />
                    {translate("workspace.email.sendButton")}
                  </Button>
                }
              />
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{translate("workspace.email.confirmTitle")}</DialogTitle>
                  <DialogDescription>
                    {translate("workspace.email.confirmDescription", {
                      count: recipientCount,
                    })}
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">
                    {translate("workspace.email.confirmSubjectLabel")}
                  </span>{" "}
                  <span className="text-foreground-muted">{subject.trim()}</span>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmOpen(false)}
                  >
                    {translate("workspace.email.cancelButton")}
                  </Button>
                  <Button
                    type="button"
                    disabled={blasting}
                    onClick={() => void submitBlast()}
                  >
                    {blasting
                      ? translate("detail.labels.refreshing")
                      : translate("workspace.email.confirmButton")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
