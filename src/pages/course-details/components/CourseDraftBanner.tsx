import { Link } from "react-router";
import { Eye, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface CourseDraftBannerProps {
  courseId: string;
}

export function CourseDraftBanner({ courseId }: CourseDraftBannerProps) {
  const { t } = useTranslation("courses");
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/25 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <Eye className="size-5 shrink-0 text-warning" aria-hidden />
        <span className="text-sm font-medium text-warning">
          {String(t("detail.courseDetail.previewDraftNotice"))}
        </span>
      </div>
      <Button
        render={<Link to={`/instructor/courses/${courseId}/edit`} />}
        nativeButton={false}
        size="sm"
        className="inline-flex items-center gap-2"
      >
        <Pencil className="size-4 shrink-0" aria-hidden />{" "}
        {String(t("detail.courseDetail.editCourse"))}
      </Button>
    </div>
  );
}
