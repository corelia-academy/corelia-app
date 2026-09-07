import type { ReactNode } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { ContestDetailSubmissionCollaboration } from "@/pages/hackathon-detail/components/ContestDetailSubmissionCollaboration";

function SubmissionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SubmissionField({
  id,
  label,
  required,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function ContestDetailParticipantSubmissionCard({
  vm,
  embedded,
}: {
  vm: ContestDetailViewModel;
  embedded?: boolean;
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
    submissionVideoUrl,
    setSubmissionVideoUrl,
    submissionDraftDirty,
    savingSubmission,
    handleSubmissionSave,
    mySubmission,
    submissionWorkspaceEditable,
  } = vm;

  const inner = (
    <>
      {!embedded ? (
        <div className="flex items-center gap-3">
          <CheckCheck className="size-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {translate("detail.participant.submissionWorkspaceTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
              {translate(
                "detail.participant.submissionWorkspaceApprovedBody",
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {translate("detail.participant.submissionWorkspaceTitle")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            {translate("detail.participant.submissionWorkspaceApprovedBody")}
          </p>
        </div>
      )}

      <div className={cn("space-y-4", embedded ? "mt-0" : "mt-4")}>
          {!submissionWorkspaceEditable ? (
            <div className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-foreground-muted">
              {translate("detail.participant.submissionDeadlineLockedBanner")}
            </div>
          ) : null}
          <SubmissionGroup title={translate("detail.forms.submission.projectGroup")}>
            <SubmissionField
              id="hackathon-submission-title"
              label={translate("detail.forms.submission.titleLabel")}
              required
            >
              <input
                id="hackathon-submission-title"
                value={submissionTitle}
                onChange={(e) => setSubmissionTitle(e.target.value)}
                disabled={!submissionWorkspaceEditable}
                className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-40"
                placeholder={translate(
                  "detail.forms.submission.titlePlaceholder",
                )}
              />
            </SubmissionField>
            <SubmissionField
              id="hackathon-submission-summary"
              label={translate("detail.forms.submission.summaryLabel")}
            >
              <textarea
                id="hackathon-submission-summary"
                rows={5}
                value={submissionSummary}
                onChange={(e) => setSubmissionSummary(e.target.value)}
                disabled={!submissionWorkspaceEditable}
                className="min-h-32 w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-40"
                placeholder={translate(
                  "detail.forms.submission.summaryPlaceholder",
                )}
              />
            </SubmissionField>
          </SubmissionGroup>

          <SubmissionGroup title={translate("detail.forms.submission.linksGroup")}>
            <SubmissionField
              id="hackathon-submission-demo-url"
              label={translate("detail.forms.submission.demoUrlLabel")}
            >
              <input
                id="hackathon-submission-demo-url"
                value={submissionDemoUrl}
                onChange={(e) => setSubmissionDemoUrl(e.target.value)}
                disabled={!submissionWorkspaceEditable}
                className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-40"
                placeholder={translate(
                  "detail.forms.submission.demoUrlPlaceholder",
                )}
              />
            </SubmissionField>
            <SubmissionField
              id="hackathon-submission-repo-url"
              label={translate("detail.forms.submission.repoUrlLabel")}
            >
              <input
                id="hackathon-submission-repo-url"
                value={submissionRepoUrl}
                onChange={(e) => setSubmissionRepoUrl(e.target.value)}
                disabled={!submissionWorkspaceEditable}
                className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-40"
                placeholder={translate(
                  "detail.forms.submission.repoUrlPlaceholder",
                )}
              />
            </SubmissionField>
            <SubmissionField
              id="hackathon-submission-slide-url"
              label={translate("detail.forms.submission.slideUrlLabel")}
            >
              <input
                id="hackathon-submission-slide-url"
                value={submissionSlideUrl}
                onChange={(e) => setSubmissionSlideUrl(e.target.value)}
                disabled={!submissionWorkspaceEditable}
                className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-40"
                placeholder={translate(
                  "detail.forms.submission.slideUrlPlaceholder",
                )}
              />
            </SubmissionField>
          </SubmissionGroup>

          <SubmissionGroup title={translate("detail.forms.submission.mediaGroup")}>
            <SubmissionField
              id="hackathon-submission-video-url"
              label={translate("detail.forms.submission.videoUrlLabel")}
            >
              <input
                id="hackathon-submission-video-url"
                value={submissionVideoUrl}
                onChange={(e) => setSubmissionVideoUrl(e.target.value)}
                disabled={!submissionWorkspaceEditable}
                className="h-11 w-full rounded-md border border-border bg-surface-base px-3 text-sm outline-hidden transition-colors duration-150 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:opacity-40"
                placeholder={translate(
                  "detail.forms.submission.videoUrlPlaceholder",
                )}
              />
            </SubmissionField>
          </SubmissionGroup>
          {submissionDraftDirty && (
            <div className="rounded-md border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
              {translate("detail.participant.submissionDirtyWarning")}
            </div>
          )}
          <Button
            type="button"
            className="w-full min-h-11"
            disabled={
              savingSubmission ||
              !submissionWorkspaceEditable ||
              !submissionTitle.trim()
            }
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
          <div className="mt-6 border-t border-border-subtle pt-6">
            <ContestDetailSubmissionCollaboration vm={vm} />
          </div>
        </div>
    </>
  );

  if (embedded) {
    return <div className="pt-4">{inner}</div>;
  }

  return (
    <Card id="participant-workspace">
      <CardContent className="p-4">{inner}</CardContent>
    </Card>
  );
}
