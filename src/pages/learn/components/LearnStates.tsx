import { Link } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function LearnMissingCourseIdState({
  translate,
}: {
  translate: TranslateFn;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-5 shadow-sm">
        <p className="text-sm font-medium text-destructive">
          {translate("detail.missingCourseId")}
        </p>
        <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />{" "}
          {translate("detail.learn.backToCourses")}
        </Link>
      </div>
    </div>
  );
}

export function LearnLoadingState({ translate }: { translate: TranslateFn }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="flex min-h-96 flex-col items-center justify-center rounded-md border border-border-subtle bg-surface-base p-8 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" aria-hidden />
        <p className="mt-4 text-sm text-foreground-muted">
          {translate("detail.learn.loadingPage")}
        </p>
      </div>
    </div>
  );
}

export function LearnErrorState({
  translate,
  message,
}: {
  translate: TranslateFn;
  message: string;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1990px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-5 shadow-sm">
        <p className="text-sm font-medium text-destructive">{message}</p>
        <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />{" "}
          {translate("detail.learn.backToCourses")}
        </Link>
      </div>
    </div>
  );
}
