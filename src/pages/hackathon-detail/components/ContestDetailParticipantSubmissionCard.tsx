import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

export function ContestDetailParticipantSubmissionCard({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    submissionTitle,
    setSubmissionTitle,
    submissionSummary,
    setSubmissionSummary,
    submissionDemoUrl,
    setSubmissionDemoUrl,
    submissionRepoUrl,
    setSubmissionRepoUrl,
    submissionSlideUrl,
    setSubmissionSlideUrl,
    submissionDraftDirty,
    savingSubmission,
    handleSubmissionSave,
    mySubmission,
  } = vm;

  return (
    <Card id="participant-workspace">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <CheckCheck className="size-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {translate("detail.participant.submissionWorkspaceTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
              {translate(
                "detail.participant.submissionWorkspaceApprovedBody",
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <input
            value={submissionTitle}
            onChange={(e) => setSubmissionTitle(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            placeholder={translate(
              "detail.forms.submission.titlePlaceholder",
            )}
          />
          <textarea
            rows={5}
            value={submissionSummary}
            onChange={(e) => setSubmissionSummary(e.target.value)}
            className="min-h-32 w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            placeholder={translate(
              "detail.forms.submission.summaryPlaceholder",
            )}
          />
          <input
            value={submissionDemoUrl}
            onChange={(e) => setSubmissionDemoUrl(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            placeholder={translate(
              "detail.forms.submission.demoUrlPlaceholder",
            )}
          />
          <input
            value={submissionRepoUrl}
            onChange={(e) => setSubmissionRepoUrl(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            placeholder={translate(
              "detail.forms.submission.repoUrlPlaceholder",
            )}
          />
          <input
            value={submissionSlideUrl}
            onChange={(e) => setSubmissionSlideUrl(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
            placeholder={translate(
              "detail.forms.submission.slideUrlPlaceholder",
            )}
          />
          {submissionDraftDirty && (
            <div className="rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
              {translate("detail.participant.submissionDirtyWarning")}
            </div>
          )}
          <Button
            type="button"
            className="w-full min-h-11"
            disabled={savingSubmission || !submissionTitle.trim()}
            onClick={() => void handleSubmissionSave()}
          >
            {savingSubmission
              ? translate("common:status.loading")
              : mySubmission
                ? translate("detail.forms.submission.updateLabel")
                : translate("detail.forms.submission.submitLabel")}
          </Button>
          <p className="text-xs leading-5 text-foreground-muted">
            {translate("detail.participant.submissionFooterHint")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
