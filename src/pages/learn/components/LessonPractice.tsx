import { useTranslation } from "react-i18next";
import { Markdown } from "@/components/markdown/Markdown";

export function LessonPractice({
  markdown,
}: {
  markdown: string;
}) {
  const { t } = useTranslation("courses");

  return (
    <div className="mx-4 mb-8 overflow-hidden rounded-2xl border border-border-subtle shadow-card sm:mx-6">
      <div className="px-6 pt-5 pb-8 text-[15px] leading-[1.7]">
        <Markdown content={markdown} />
      </div>
      <div className="border-t border-border-subtle bg-surface-raised px-6 py-3 flex items-center justify-between gap-3">
        <p className="text-xs text-foreground-muted">
          {t("detail.learn.practice.hint")}
        </p>
      </div>
    </div>
  );
}
