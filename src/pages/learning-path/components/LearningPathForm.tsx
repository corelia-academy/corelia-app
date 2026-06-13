import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  initialGoal?: string;
  generating: boolean;
  onSubmit: (goal: string) => void;
  error?: string | null;
};

export function LearningPathForm({ initialGoal, generating, onSubmit, error }: Props) {
  const { t } = useTranslation("learningPath");
  const [goal, setGoal] = useState(initialGoal ?? "");

  useEffect(() => {
    if (!initialGoal || goal) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setGoal(initialGoal);
    });

    return () => {
      cancelled = true;
    };
  }, [initialGoal, goal]);

  const handle = () => {
    const trimmed = goal.trim();
    if (trimmed.length < 4 || generating) return;
    onSubmit(trimmed);
  };

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-raised p-5">
      <label
        htmlFor="learning-path-goal"
        className="block text-sm font-semibold text-foreground"
      >
        {t("form.goalLabel", { defaultValue: "Mục tiêu của bạn là gì?" })}
      </label>
      <p className="mt-0.5 text-xs text-foreground-muted">
        {t("form.goalHint", {
          defaultValue:
            "Mô tả 1-2 câu — Cora sẽ chọn courses và career tracks phù hợp từ catalog Corelia.",
        })}
      </p>
      <textarea
        id="learning-path-goal"
        rows={3}
        value={goal}
        disabled={generating}
        onChange={(e) => setGoal(e.target.value)}
        placeholder={String(
          t("form.goalPlaceholder", {
            defaultValue: "ví dụ: trở thành full-stack developer trong 6 tháng",
          }),
        )}
        className="mt-3 w-full resize-none rounded-md border border-border bg-surface-base px-3 py-2 text-sm text-foreground outline-none placeholder:text-foreground-subtle"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        {error ? (
          <p className="mr-auto text-xs text-destructive">{error}</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={generating || goal.trim().length < 4}
          onClick={handle}
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="ml-1">
                {t("form.generating", { defaultValue: "Cora đang dựng lộ trình…" })}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              <span className="ml-1">
                {t("form.generateAction", { defaultValue: "Tạo lộ trình" })}
              </span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
