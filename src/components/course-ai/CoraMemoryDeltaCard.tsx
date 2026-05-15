import { Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CoraMemoryDelta } from "@/hooks/useCoraAI";
import { cn } from "@/lib/utils";

export function CoraMemoryDeltaCard({
  delta,
  className,
}: {
  delta: CoraMemoryDelta | null;
  className?: string;
}) {
  const { t } = useTranslation("common");

  if (!delta) return null;

  const lines = [
    delta.newWeakTopic
      ? t("coraWidget.memoryDelta.newWeakTopic", { topic: delta.newWeakTopic })
      : null,
    delta.newStrongTopic
      ? t("coraWidget.memoryDelta.newStrongTopic", { topic: delta.newStrongTopic })
      : null,
    delta.learningStyle
      ? t("coraWidget.memoryDelta.learningStyle", {
          style: t(`coraWidget.memory.styles.${delta.learningStyle}` as never, {
            defaultValue: t("coraWidget.memory.styles.unknown"),
          }),
        })
      : null,
  ].filter(Boolean) as string[];

  if (lines.length === 0 && !delta.summary) return null;

  return (
    <div className={cn("rounded-lg border border-border-subtle bg-surface-raised p-3", className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
        <Lightbulb className="size-3.5" aria-hidden />
        {t("coraWidget.memoryDelta.title")}
      </div>
      {delta.summary ? (
        <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
          {delta.summary}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <div className="mt-2 grid gap-1.5 text-[11px] text-foreground-muted">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
