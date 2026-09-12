import { useTranslation } from "react-i18next";
import { SubmissionArtifacts } from "./SubmissionArtifacts";
import type { ArtifactField } from "./types";

export function SubmissionReviewContent({ content, artifacts, fileUrls, comment }: {
  content?: string | null;
  artifacts?: Partial<Record<ArtifactField, string>>;
  fileUrls?: string[] | null;
  comment?: string | null;
}) {
  const { t } = useTranslation("instructor");
  const attachments = Array.isArray(fileUrls) ? fileUrls : fileUrls == null ? [] : [""];
  return <details className="min-w-48 max-w-xl">
    <summary className="cursor-pointer py-2 text-primary underline">{t("courseEdit.assignments.viewSubmission")}</summary>
    <p className="whitespace-pre-wrap break-words text-foreground-muted">{content || "—"}</p>
    <SubmissionArtifacts artifacts={artifacts} />
    {!!attachments.length && <ul className="mt-3 space-y-2">
      {attachments.map((url, index) => {
        let safe = false;
        try { safe = ["https:", "http:"].includes(new URL(url).protocol); } catch { /* Malformed legacy URL. */ }
        return <li key={`${index}:${url}`}>{safe
          ? <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">{t("courseEdit.assignments.attachment", { number: index + 1 })}</a>
          : <span className="text-foreground-muted">{t("courseEdit.assignments.unavailableAttachment", { number: index + 1 })}</span>}
        </li>;
      })}
    </ul>}
    {comment && <div className="mt-3"><p className="font-medium">{t("courseEdit.assignments.feedback")}</p><p className="whitespace-pre-wrap break-words text-foreground-muted">{comment}</p></div>}
  </details>;
}
