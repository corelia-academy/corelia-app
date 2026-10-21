import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Course } from "@/types/courses";

export function AiCourseBadge({ course }: { course: Pick<Course, "course_type"> }) {
  const { t } = useTranslation("courses");
  if (course.course_type !== "ai_generated") return null;
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge size="xsmall" color="cyan" tabIndex={0} />}>
        {t("aiGenerated.label")}
      </TooltipTrigger>
      <TooltipContent>{t("aiGenerated.description")}</TooltipContent>
    </Tooltip>
  );
}
