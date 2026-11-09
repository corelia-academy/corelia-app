import { EmptyStateIllustration } from "@/components/ui/empty-state-illustration";
import { useLearningTranslation } from "./useLearningTranslation";

/** Figma "Data Connection Failure": shown when lesson data cannot be displayed and a reload will not fix it. */
export function LessonDataError() {
  const { t } = useLearningTranslation();
  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center gap-xl py-6xl">
      <EmptyStateIllustration
        type="error"
        size="fullPage"
        title={t("learning.lessonDataErrorTitle")}
        description={t("learning.lessonDataErrorDescription")}
        contentClassName="w-auto sm:[&>p:first-child]:whitespace-nowrap"
      />
    </div>
  );
}
