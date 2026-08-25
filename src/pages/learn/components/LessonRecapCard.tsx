import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { useLessonSummary } from "@/hooks/useLessonSummary";

type Props = {
  lessonId: string | null;
  courseId?: string | null;
  lessonTitle?: string;
  lessonContent?: string;
  youtubeUrl?: string;
  completed?: boolean;
  locale?: "vi" | "en";
};

export function LessonRecapCard({ lessonId, courseId, completed = true, locale }: Props) {
  const { t } = useTranslation("courses");
  const { summary, loading } = useLessonSummary({
    lessonId,
    courseId,
    locale,
  });

  if (!completed || !lessonId || loading || !summary) return null;

  const hasTips = summary.practicalTips.length > 0;

  return (
    <div className="mx-4 mt-4 overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised shadow-card sm:mx-6">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden />
          {t("detail.learn.recap.title", { defaultValue: "Cora's recap" })}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4 text-[14.5px] leading-[1.7]">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
            {t("detail.learn.recap.keyPointsLabel", {
              defaultValue: "Key takeaways",
            })}
          </h4>
          <ul className="mt-2 space-y-1.5 list-disc pl-5 text-foreground">
            {summary.keyPoints.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        </section>

        {hasTips ? (
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {t("detail.learn.recap.practicalTipsLabel", {
                defaultValue: "Practical tips",
              })}
            </h4>
            <ul className="mt-2 space-y-1.5 list-disc pl-5 text-foreground">
              {summary.practicalTips.map((tip, idx) => (
                <li key={idx}>{tip}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
