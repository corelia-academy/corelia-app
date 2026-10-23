import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CourseBadge } from "@/components/courses/CourseBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Course } from "@/types/courses";

export function AiCourseBadge({ course }: { course: Pick<Course, "course_type"> }) {
  const { t } = useTranslation("courses");
  if (course.course_type !== "ai_generated") return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <CourseBadge tabIndex={0} className="gap-1">
            <Sparkles className="size-3.5" aria-hidden />
            {t("aiGenerated.label")}
          </CourseBadge>
        }
      />
      <TooltipContent>{t("aiGenerated.description")}</TooltipContent>
    </Tooltip>
  );
}
