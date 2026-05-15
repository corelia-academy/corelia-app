import { Brain, Flame, Layers3, Trophy } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CoraLearningMemory } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

export function CoraLearningMemorySummary({
  memory,
  className,
}: {
  memory: CoraLearningMemory | null;
  className?: string;
}) {
  const { t } = useTranslation("common");
  const resolvedStyle = memory?.learningStyle
    ? t(`coraWidget.memory.styles.${memory.learningStyle}` as never, {
        defaultValue: t("coraWidget.memory.styles.unknown"),
      })
    : t("coraWidget.memory.styles.unknown");

  if (!memory) return null;

  return (
    <div className={cn("rounded-lg border border-border-subtle bg-surface-raised p-3", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <Brain className="size-3.5" aria-hidden />
        {t("coraWidget.memory.title")}
      </div>
      {memory.summary ? (
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
          {memory.summary}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 text-[11px] text-foreground-muted">
        <div className="flex items-start gap-2">
          <Layers3 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t("coraWidget.memory.style", { style: resolvedStyle })}</span>
        </div>
        <div className="flex items-start gap-2">
          <Flame className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {memory.weakTopics.length > 0
              ? t("coraWidget.memory.weakTopics", { topics: memory.weakTopics.slice(0, 2).join(", ") })
              : t("coraWidget.memory.weakTopicsEmpty")}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Trophy className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {memory.strongTopics.length > 0
              ? t("coraWidget.memory.strongTopics", { topics: memory.strongTopics.slice(0, 2).join(", ") })
              : t("coraWidget.memory.strongTopicsEmpty")}
          </span>
        </div>
      </div>
    </div>
  );
}
