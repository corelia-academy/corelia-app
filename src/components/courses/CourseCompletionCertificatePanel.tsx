import { Award, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { CertificateIssueReason } from "@/lib/courses";
import { cn } from "@/lib/utils";

interface CourseCompletionCertificatePanelProps {
  className?: string;
  hasCertificate: boolean;
  certificateIssued: boolean;
  issuing?: boolean;
  issueReason?: CertificateIssueReason | null;
  issueError?: string | null;
  achievementsPath: string;
  onRetry?: () => void;
}

export function CourseCompletionCertificatePanel({
  className,
  hasCertificate,
  certificateIssued,
  issuing = false,
  issueReason = null,
  issueError = null,
  achievementsPath,
  onRetry,
}: CourseCompletionCertificatePanelProps) {
  const { t } = useTranslation("courses");
  const bodyKey = (() => {
    if (issueError) return "detail.learn.completion.certificateSyncFailed";
    if (!hasCertificate) {
      return issuing
        ? "detail.learn.completion.completionSaving"
        : "detail.learn.completion.noCertificate";
    }
    if (certificateIssued) return "detail.learn.completion.certificateReady";
    if (issuing) return "detail.learn.completion.certificateIssuing";
    if (issueReason && issueReason !== "unknown") {
      return `detail.learn.completion.reasons.${issueReason}`;
    }
    return "detail.learn.completion.certificatePending";
  })();

  const showRetry = !certificateIssued && !issuing && !!onRetry && (hasCertificate || !!issueError);

  return (
    <div
      className={cn(
        "rounded-2xl border border-success/25 bg-success/10 p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            {issuing ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : hasCertificate ? (
              <Award className="size-5" aria-hidden />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">
              {t("detail.learn.completion.title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
              {issueError || t(bodyKey as never)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {hasCertificate && certificateIssued ? (
            <Button
              type="button"
              size="sm"
              render={<Link to={achievementsPath} />}
              nativeButton={false}
            >
              {t("detail.learn.completion.viewCertificate")}
            </Button>
          ) : null}
          {showRetry ? (
            <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
              <RefreshCw className="size-4" aria-hidden />
              {t("detail.learn.completion.retryCertificateSync")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
