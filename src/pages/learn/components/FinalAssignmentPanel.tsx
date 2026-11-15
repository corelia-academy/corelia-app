import { useTranslation } from "react-i18next";
import type { ArtifactField } from "@/features/learning/types";
import { validArtifact } from "@/features/learning/validation";
import { normalizeArtifactDraft, readArtifactDraft } from "@/features/learning/artifactDraft";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LessonColumn } from "@/features/learning/lessonLayout";
import { uploadFinalAssignmentFile } from "@/lib/storage";
import type { Course } from "@/types/courses";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

type SubmissionRow = {
  status: "pending" | "approved" | "rejected";
  reviewer_comment?: string | null;
} | null;

interface FinalAssignmentPanelProps {
  courseId: string;
  course: Course;
  profileId: string;
  submission: SubmissionRow;
  submissionState?: "loading" | "error" | "ready";
  onRetryLoad?: () => void;
  translate: TranslateFn;
  initialArtifacts?: Partial<Record<ArtifactField, string>>;
  onSubmit: (input: { content: string; fileUrls?: string[]; artifacts?: Partial<Record<ArtifactField, string>>; requestId?: string }) => Promise<void>;
}

export function FinalAssignmentPanel(props: FinalAssignmentPanelProps) {
  return <FinalAssignmentForm key={`${props.courseId}:${props.profileId}`} {...props} />;
}

function FinalAssignmentForm({ courseId, course, profileId, initialArtifacts, submission, submissionState = "ready", onRetryLoad, translate, onSubmit }: FinalAssignmentPanelProps) {
  const { t } = useTranslation("courses");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const pendingPayload = useRef<Parameters<FinalAssignmentPanelProps["onSubmit"]>[0] | null>(null);
  const uploadedFiles = useRef(new Map<File, string>());
  const inFlight = useRef(false);
  const [awaitingResult, setAwaitingResult] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);
  const [artifacts, setArtifacts] = useState(() => ({ ...readArtifactDraft(`corelia:final-artifacts:${profileId}:${courseId}`), ...normalizeArtifactDraft(initialArtifacts) }));
  useEffect(() => {
    const restore = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; courseId: string; artifacts: Partial<Record<ArtifactField, string>> }>).detail;
      if (!inFlight.current && !pendingPayload.current && detail?.userId === profileId && detail.courseId === courseId) setArtifacts(previous => ({ ...previous, ...normalizeArtifactDraft(detail.artifacts) }));
    };
    window.addEventListener("learning:final-artifacts", restore);
    return () => window.removeEventListener("learning:final-artifacts", restore);
  }, [profileId, courseId]);
  const contentRequired = !course.final_assignment_fields?.length;
  const valid = (course.final_assignment_fields ?? []).every(f => validArtifact(f, artifacts[f] ?? ""));
  const [submitting, setSubmitting] = useState(false);
  const [submitContent, setSubmitContent] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);
  const canSubmit = valid && Boolean(profileId) && (!contentRequired || Boolean(submitContent.trim()));
  const contentId = useId();
  const filesId = useId();


  const handleSubmit = async () => {
    if (submissionState !== "ready" || (submission && submission.status !== "rejected")) return;
    if (inFlight.current || (!pendingPayload.current && !canSubmit)) return;
    inFlight.current = true;
    setError(null);
    setSubmitting(true);
    try {
      if (!pendingPayload.current) {
        const fileUrls: string[] = [];
        for (const file of submitFiles) {
          let url = uploadedFiles.current.get(file);
          if (!url) {
            const uploaded = await uploadFinalAssignmentFile(courseId, profileId, file);
            url = uploaded.url;
            uploadedFiles.current.set(file, url);
          }
          fileUrls.push(url);
        }
        pendingPayload.current = {
          content: submitContent.trim(),
          artifacts: { ...artifacts },
          requestId,
          fileUrls: fileUrls.length ? fileUrls : undefined,
        };
        setAwaitingResult(true);
      }
      await onSubmit(pendingPayload.current);
      pendingPayload.current = null;
      uploadedFiles.current.clear();
      setAwaitingResult(false);
      if (filesInput.current) filesInput.current.value = "";
      setRequestId(crypto.randomUUID());
      setSubmitContent("");
      setSubmitFiles([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("learning.systemError"));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (!course.final_assignment_title) return null;

  return (
    <LessonColumn id="final-assignment" className="flex flex-col gap-6xl pb-7xl pt-6xl">
      <div>
        <h1 className="text-heading-large font-display text-action-text">
          {course.final_assignment_title}
        </h1>
        {course.final_assignment_description ? (
          <p className="mt-3xl whitespace-pre-wrap text-body-medium text-action-text">
            {course.final_assignment_description}
          </p>
        ) : null}
      </div>

      {course.final_assignment_instructions ? (
        <div className="rounded-xl border border-border bg-surface-raised p-6 text-body-medium text-foreground-muted">
          <p className="whitespace-pre-wrap">
            {course.final_assignment_instructions}
          </p>
        </div>
      ) : null}

      {submissionState === "loading" && <p role="status" className="text-body-medium text-foreground-muted">{t("learning.loading")}</p>}
      {submissionState === "error" && (
        <div role="alert" className="space-y-3">
          <p className="text-body-medium text-destructive">{t("learning.loadError")}</p>
          {onRetryLoad && <Button type="button" variant="cta" hierarchy="secondary" size="small" onClick={onRetryLoad}>{t("learning.retry")}</Button>}
        </div>
      )}
      {submission ? (
        <div className="rounded-xl border border-border bg-surface-raised p-6">
          <p className="text-body-medium font-medium text-foreground">
            {submission.status === "approved"
              ? translate("detail.learn.finalAssignment.status.approved")
              : submission.status === "rejected"
                ? translate("detail.learn.finalAssignment.status.rejected")
                : translate("detail.learn.finalAssignment.status.pending")}
          </p>
          {submission.reviewer_comment ? (
            <p className="mt-2 text-body-medium text-foreground-muted">
              {submission.reviewer_comment}
            </p>
          ) : null}
        </div>
      ) : null}

      {submissionState === "ready" && (submission?.status === "rejected" || !submission) ? (
        <div className="space-y-6">
          {(course.final_assignment_fields ?? []).map(field => (
            <Field key={field} label={t(`learning.artifacts.${field}`)} required>
              <Input
                disabled={submitting || awaitingResult}
                value={artifacts[field] ?? ""}
                onChange={e => setArtifacts(a => ({ ...a, [field]: e.target.value }))}
              />
            </Field>
          ))}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {error && awaitingResult && <p className="text-sm text-foreground-muted">{t("learning.finalRetrySameSubmission")}</p>}
          {!profileId && <p className="text-sm text-foreground-muted">{t("learning.loginToSave")}</p>}
          <div className="space-y-1.5">
            <Label htmlFor={contentId}>
              {t(contentRequired ? "learning.finalContentRequired" : "learning.finalContentOptional")}
            </Label>
            <textarea
              id={contentId}
              required={contentRequired}
              disabled={submitting || awaitingResult}
              placeholder={translate("detail.learn.finalAssignment.contentPlaceholder")}
              value={submitContent}
              onChange={(e) => setSubmitContent(e.target.value)}
              className="min-h-36 w-full rounded-md border border-border bg-surface-base px-3 py-2 text-sm leading-relaxed outline-none transition-colors duration-150 placeholder:text-foreground-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              rows={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={filesId}>
              {translate("detail.learn.finalAssignment.attachmentsLabel")}
            </Label>
            <input
              id={filesId}
              ref={filesInput}
              disabled={submitting || awaitingResult}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.zip"
              className="block w-full rounded-md border border-border bg-surface-base text-sm text-foreground-muted transition-colors duration-150 file:mr-4 file:rounded-none file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:opacity-90 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15"
              onChange={(e) => setSubmitFiles(Array.from(e.target.files ?? []))}
            />
          </div>
          <div>
            <Button
              type="button"
              variant="cta"
              hierarchy="primary"
              size="medium"
              onClick={() => void handleSubmit()}
              disabled={submitting || (!awaitingResult && !canSubmit)}
            >
              {submitting
                ? translate("detail.learn.finalAssignment.submitting")
                : error && awaitingResult ? t("learning.retry") : translate("detail.learn.finalAssignment.submit")}
            </Button>
          </div>
        </div>
      ) : null}
    </LessonColumn>
  );
}
