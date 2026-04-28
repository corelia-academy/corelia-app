import { Link } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ReportIssueLink } from "@/components/feedback/ReportIssueLink";

export function CourseDetailLoading() {
  const { t } = useTranslation("courses");
  return (
    <div className="container-app py-6 sm:py-8">
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-md border border-border-subtle bg-card p-8 text-center shadow-card">
        <Loader2
          className="size-8 animate-spin text-muted-foreground"
          aria-hidden
        />
        <p className="mt-4 text-sm text-muted-foreground">
          {String(t("detail.loadingCourse"))}
        </p>
      </div>
    </div>
  );
}

export function CourseDetailError({ message }: { message?: string | null }) {
  const { t } = useTranslation("courses");
  return (
    <div className="container-app py-6 sm:py-8">
      <div className="rounded-md border border-destructive/20 bg-destructive/10 p-5 shadow-card">
        <p className="text-sm font-medium text-destructive">
          {message ?? String(t("detail.notFound"))}
        </p>
        <ReportIssueLink className="mt-3 h-8 rounded-full px-3 text-xs text-destructive hover:text-destructive" />
        <Link
          to="/courses"
          className="mt-4 inline-flex items-center gap-2 text-sm text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />{" "}
          {String(t("detail.courseDetail.backToCoursesList"))}
        </Link>
      </div>
    </div>
  );
}
