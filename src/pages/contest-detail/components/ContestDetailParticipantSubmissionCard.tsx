import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

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
      <CardContent className="p-6">
    <div className="flex items-center gap-3">
      <CheckCheck className="size-5 text-primary" aria-hidden />
      <div>
        <h2 className="text-lg font-medium tracking-tight text-foreground">
          {translate("detail.participant.submissionWorkspaceTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
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
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={translate(
          "detail.forms.submission.titlePlaceholder",
        )}
      />
      <textarea
        rows={5}
        value={submissionSummary}
        onChange={(e) => setSubmissionSummary(e.target.value)}
        className="min-h-32 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={translate(
          "detail.forms.submission.summaryPlaceholder",
        )}
      />
      <input
        value={submissionDemoUrl}
        onChange={(e) => setSubmissionDemoUrl(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={translate(
          "detail.forms.submission.demoUrlPlaceholder",
        )}
      />
      <input
        value={submissionRepoUrl}
        onChange={(e) => setSubmissionRepoUrl(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={translate(
          "detail.forms.submission.repoUrlPlaceholder",
        )}
      />
      <input
        value={submissionSlideUrl}
        onChange={(e) => setSubmissionSlideUrl(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={translate(
          "detail.forms.submission.slideUrlPlaceholder",
        )}
      />
      {submissionDraftDirty && (
        <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          {translate("detail.participant.submissionDirtyWarning")}
        </div>
      )}
      <Button
        type="button"
        className="w-full"
        disabled={savingSubmission || !submissionTitle.trim()}
        onClick={() => void handleSubmissionSave()}
      >
        {savingSubmission
          ? translate("common:status.loading")
          : mySubmission
            ? translate("detail.forms.submission.updateLabel")
            : translate("detail.forms.submission.submitLabel")}
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        {translate("detail.participant.submissionFooterHint")}
      </p>
    </div>
      </CardContent>
    </Card>
  );
}
