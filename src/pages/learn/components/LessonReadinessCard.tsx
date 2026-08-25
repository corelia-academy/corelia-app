import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReadinessCheck } from "@/hooks/useReadinessCheck";
import { cn } from "@/lib/utils";
import type { CourseLesson, SupportedCourseLocale } from "@/types/courses";

type Props = {
  lesson: CourseLesson | null;
  courseId: string | null;
  allLessons?: CourseLesson[];
  lessonTitle?: string;
  lessonContent?: string;
  locale?: SupportedCourseLocale;
  onJumpToLesson?: (lessonId: string) => void;
};

type Phase = "idle" | "in_progress" | "result";

export function LessonReadinessCard({
  lesson,
  courseId,
  allLessons = [],
  locale = "vi",
  onJumpToLesson,
}: Props) {
  const { t } = useTranslation("courses");
  const lessonId = lesson?.id ?? null;

  const { check, loading, submitting, error, submit, skip } =
    useReadinessCheck({ lessonId, courseId, locale });

  const [phase, setPhase] = useState<Phase>("idle");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [questionIndex, setQuestionIndex] = useState(0);

  // — Render guards —
  if (!lesson || !courseId || loading || !check || check.questions.length === 0) return null;
  // Already reviewed (passed/failed/skipped) → don't show banner
  if (check.reviewedAt && phase === "idle") return null;

  const prereqLessons = allLessons.filter((l) => check.sourceLessonIds.includes(l.id));

  const handleStart = () => {
    setQuestionIndex(0);
    setAnswers({});
    setPhase("in_progress");
  };

  const handleSkip = async () => {
    await skip();
    setPhase("idle");
  };

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleNext = async () => {
    if (!check) return;
    const isLast = questionIndex >= check.questions.length - 1;
    if (!isLast) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    const userAnswers = check.questions
      .map((q) => ({ questionId: q.id, selectedIndex: answers[q.id] ?? -1 }))
      .filter((a) => a.selectedIndex >= 0);
    await submit(userAnswers);
    setPhase("result");
  };

  // — Phase: in_progress —
  if (phase === "in_progress" && check && check.questions.length > 0) {
    const question = check.questions[questionIndex];
    if (!question) return null;
    const selectedIndex = answers[question.id];
    const isLast = questionIndex >= check.questions.length - 1;
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:mx-6">
        <div className="mb-3 flex items-center justify-between text-xs text-foreground-muted">
          <span className="font-medium">
            {t("detail.learn.readinessCheck.questionCounter", {
              current: questionIndex + 1,
              total: check.questions.length,
              defaultValue: "Câu {{current}}/{{total}}",
            })}
          </span>
        </div>
        <p className="text-[15px] font-medium leading-[1.65] text-foreground">
          {question.question}
        </p>
        <div className="mt-3 space-y-2">
          {question.options.map((option, idx) => {
            const selected = selectedIndex === idx;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleAnswer(question.id, idx)}
                className={cn(
                  "block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface-base text-foreground hover:border-primary/40",
                )}
              >
                {option.text}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            disabled={selectedIndex === undefined || submitting}
            onClick={() => void handleNext()}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            <span className="ml-1">
              {isLast
                ? t("detail.learn.readinessCheck.submitAction", {
                    defaultValue: "Nộp bài",
                  })
                : t("detail.learn.readinessCheck.nextAction", {
                    defaultValue: "Tiếp",
                  })}
            </span>
          </Button>
        </div>
      </div>
    );
  }

  // — Phase: result —
  if (phase === "result" && check) {
    const passed = check.passed === true;
    return (
      <div
        className={cn(
          "mx-4 mt-4 rounded-2xl border p-5 sm:mx-6",
          passed
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className="flex items-start gap-2">
          {passed ? (
            <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" aria-hidden />
          ) : (
            <Sparkles className="mt-0.5 size-5 text-amber-500" aria-hidden />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {passed
                ? t("detail.learn.readinessCheck.passedTitle", {
                    defaultValue: "Sẵn sàng! 🎯",
                  })
                : t("detail.learn.readinessCheck.failedTitle", {
                    defaultValue: "Nên ôn lại trước",
                  })}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {passed
                ? t("detail.learn.readinessCheck.passedSubtitle", {
                    defaultValue: "Bạn nắm vững kiến thức nền cho bài này.",
                  })
                : t("detail.learn.readinessCheck.failedSubtitle", {
                    defaultValue: "Cora gợi ý bạn xem lại những bài này:",
                  })}
            </p>
            {!passed && prereqLessons.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {prereqLessons.map((l) => {
                  const title =
                    typeof l.title === "string" && l.title.trim()
                      ? l.title.trim()
                      : `Bài ${(l.order ?? 0) + 1}`;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => onJumpToLesson?.(l.id)}
                        className="text-sm text-primary hover:underline"
                      >
                        {title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => setPhase("idle")}>
            {passed
              ? t("detail.learn.readinessCheck.passedAction", {
                  defaultValue: "Bắt đầu học",
                })
              : t("detail.learn.readinessCheck.failedAction", {
                  defaultValue: "Vẫn vào học",
                })}
          </Button>
        </div>
      </div>
    );
  }

  // — Phase: idle (default banner) —
  return (
    <div className="mx-4 mt-4 rounded-2xl border border-border-subtle bg-surface-raised p-5 sm:mx-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("detail.learn.readinessCheck.title", {
                defaultValue: "Kiểm tra sẵn sàng",
              })}
            </p>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {t("detail.learn.readinessCheck.subtitle", {
                count: check.questions.length,
                defaultValue:
                  "Kiểm tra nhanh {{count}} câu về kiến thức nền trước khi bắt đầu.",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={() => void handleSkip()}
          >
            {t("detail.learn.readinessCheck.skipAction", { defaultValue: "Bỏ qua" })}
          </Button>
          <Button
            size="sm"
            onClick={handleStart}
          >
            {t("detail.learn.readinessCheck.startAction", {
              defaultValue: "Bắt đầu kiểm tra",
            })}
          </Button>
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
