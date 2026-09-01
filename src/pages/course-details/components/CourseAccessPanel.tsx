import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CourseLesson } from "@/types/courses";

interface CourseAccessPanelProps {
  resolvedCourseId: string | null;
  enrolled: boolean;
  progressPercent: number;
  isPublicEmptyCurriculum: boolean;
  hasStarted: boolean;
  nextLesson: CourseLesson | null;
  enrolling: boolean;
  onContinue: () => void;
  onEnroll: () => void;
  className?: string;
}

export function CourseAccessPanel({
  resolvedCourseId,
  enrolled,
  progressPercent,
  isPublicEmptyCurriculum,
  hasStarted,
  nextLesson,
  enrolling,
  onContinue,
  onEnroll,
  className,
}: CourseAccessPanelProps) {
  const { t } = useTranslation("courses");
  const translate = (key: string, options?: Record<string, unknown>) =>
    String(t(key as never, options as never));

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border-subtle bg-surface-base shadow-card", className)}>
      <div className="border-b border-border-subtle bg-surface-raised px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">{translate("detail.accessPanel.ready")}</h3>
      </div>
      <div className="p-4">
        {isPublicEmptyCurriculum ? (
          <p className="text-sm leading-relaxed text-foreground-muted">{translate("detail.accessPanel.contentComingSoon")}</p>
        ) : enrolled ? (
          <>
            <p className="mb-3 text-sm leading-relaxed text-foreground-muted">{translate("detail.accessPanel.enterToLearn")}</p>
            <div className="mb-4 rounded-md bg-surface-raised p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-foreground-muted">
                <span>{translate("detail.accessPanel.currentProgress")}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-base">
                <div className="h-full rounded-full bg-success" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <Button className="w-full" onClick={onContinue} disabled={!resolvedCourseId}>
              {nextLesson
                ? hasStarted
                  ? translate("detail.spotlight.continueLearning")
                  : translate("catalog.card.startLearning")
                : translate("detail.spotlight.enterLearningPage")}
              <ArrowRight className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm leading-relaxed text-foreground-muted">{translate("detail.accessPanel.freeEnrollCopy")}</p>
            <Button className="w-full" disabled={enrolling} onClick={onEnroll}>
              {enrolling ? translate("detail.accessPanel.processing") : translate("detail.accessPanel.enrollAndEnter")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
