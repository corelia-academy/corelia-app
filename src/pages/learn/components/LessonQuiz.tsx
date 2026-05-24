import { useEffect, useReducer, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLessonQuestions } from "@/lib/sectionQuestions";
import { getLessonQuizResult, submitLessonQuizAttempts } from "@/lib/quizAttempts";
import type { SectionQuestion, SectionQuizResult } from "@/types/questions";

type QuizStatus = "loading" | "idle" | "submitting" | "done" | "error";

type QuizState = {
  status: QuizStatus;
  selectedAnswers: Record<string, number>;
  result: SectionQuizResult | null;
};

type QuizAction =
  | { type: "RESET" }
  | { type: "LOADED_IDLE" }
  | { type: "LOADED_DONE"; answers: Record<string, number>; result: SectionQuizResult }
  | { type: "ERROR" }
  | { type: "SUBMITTING" }
  | { type: "DONE"; result: SectionQuizResult }
  | { type: "SUBMIT_ERROR" }
  | { type: "SELECT"; questionId: string; index: number }
  | { type: "RETRY" };

function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "RESET":
      return { status: "loading", selectedAnswers: {}, result: null };
    case "LOADED_IDLE":
      return { ...state, status: "idle" };
    case "LOADED_DONE":
      return { status: "done", selectedAnswers: action.answers, result: action.result };
    case "ERROR":
      return { ...state, status: "error" };
    case "SUBMITTING":
      return { ...state, status: "submitting" };
    case "DONE":
      return { ...state, status: "done", result: action.result };
    case "SUBMIT_ERROR":
      return { ...state, status: "idle" };
    case "SELECT":
      return { ...state, selectedAnswers: { ...state.selectedAnswers, [action.questionId]: action.index } };
    case "RETRY":
      return { status: "idle", selectedAnswers: {}, result: null };
    default:
      return state;
  }
}

const initialQuizState: QuizState = { status: "loading", selectedAnswers: {}, result: null };

export function LessonQuiz({
  courseId,
  lessonId,
  lessonTitle,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle?: string | null;
}) {
  const [questions, setQuestions] = useState<SectionQuestion[]>([]);
  const [quizUIState, dispatch] = useReducer(quizReducer, initialQuizState);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { status: quizState, selectedAnswers, result } = quizUIState;

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "RESET" });

    async function load() {
      try {
        const [qs, existingResult] = await Promise.all([
          getLessonQuestions(courseId, lessonId),
          getLessonQuizResult(courseId, lessonId, 0).catch(() => null),
        ]);
        if (cancelled) return;
        setQuestions(qs);
        if (existingResult && existingResult.completed) {
          const answers: Record<string, number> = {};
          for (const a of existingResult.attempts) {
            answers[a.question_id] = a.selected_index;
          }
          dispatch({ type: "LOADED_DONE", answers, result: { ...existingResult, total: qs.length } });
        } else {
          dispatch({ type: "LOADED_IDLE" });
        }
      } catch {
        if (!cancelled) dispatch({ type: "ERROR" });
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [courseId, lessonId]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  async function handleSubmit() {
    if (!allAnswered || quizState === "submitting") return;
    dispatch({ type: "SUBMITTING" });
    setSubmitError(null);
    try {
      const attempts = questions.map((q) => ({
        courseId,
        lessonId,
        questionId: q.id,
        selectedIndex: selectedAnswers[q.id] ?? 0,
        isCorrect: (selectedAnswers[q.id] ?? -1) === q.correct_index,
      }));
      const saved = await submitLessonQuizAttempts(attempts);
      const correct = saved.filter((a) => a.is_correct).length;
      const newResult: SectionQuizResult = {
        section_id: lessonId,
        total: questions.length,
        correct,
        completed: true,
        attempts: saved,
      };
      dispatch({ type: "DONE", result: newResult });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Không thể lưu kết quả.");
      dispatch({ type: "SUBMIT_ERROR" });
    }
  }

  function handleRetry() {
    dispatch({ type: "RETRY" });
    setSubmitError(null);
  }

  if (quizState === "loading") {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted">
        <Loader2 className="size-5 animate-spin mr-2" aria-hidden />
        <span className="text-sm">Đang tải bài kiểm tra…</span>
      </div>
    );
  }

  if (quizState === "error" || questions.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-6 text-center text-sm text-foreground-muted">
        {quizState === "error"
          ? "Không thể tải câu hỏi. Vui lòng thử lại."
          : "Bài kiểm tra chưa có câu hỏi."}
      </div>
    );
  }

  const isReview = quizState === "done" && !!result;
  const reviewMap = isReview
    ? new Map(result!.attempts.map((a) => [a.question_id, a]))
    : null;
  const scorePercent = result
    ? Math.round((result.correct / result.total) * 100)
    : null;

  return (
    <div className="px-4 py-6 pb-8 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            Bài kiểm tra{lessonTitle ? `: ${lessonTitle}` : ""}
          </h2>
          <p className="text-[13px] text-foreground-muted">
            {questions.length} câu hỏi trắc nghiệm về nội dung bài học này.
          </p>
        </div>

        {/* Score banner */}
        {isReview && scorePercent !== null && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-4 py-3",
              scorePercent >= 70
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            <Trophy className="size-5 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="font-medium text-sm">
                {result!.correct}/{result!.total} câu đúng ({scorePercent}%)
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {scorePercent >= 70
                  ? "Tốt lắm! Bạn đã nắm vững nội dung bài học."
                  : "Hãy xem lại bài học và thử lại nhé!"}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleRetry} className="shrink-0">
              <RotateCcw className="size-3.5 mr-1.5" aria-hidden />
              Làm lại
            </Button>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-5">
          {questions.map((q, qi) => {
            const attempt = reviewMap?.get(q.id);
            const selected = selectedAnswers[q.id];

            return (
              <div key={q.id} className="space-y-3">
                <p className="text-sm font-medium text-foreground leading-snug">
                  <span className="text-foreground-muted mr-1.5">{qi + 1}.</span>
                  {q.question}
                </p>

                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = isReview ? attempt?.selected_index === oi : selected === oi;
                    const isCorrect = oi === q.correct_index;
                    const isWrong = isReview && isSelected && !isCorrect;
                    const showCorrect = isReview && isCorrect;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isReview}
                        onClick={() => {
                          if (isReview) return;
                          dispatch({ type: "SELECT", questionId: q.id, index: oi });
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                          !isReview && [
                            "hover:bg-surface-raised cursor-pointer",
                            selected === oi
                              ? "border-brand-accent bg-brand-accent/5 text-foreground"
                              : "border-border-subtle text-foreground-muted",
                          ],
                          isReview && [
                            "cursor-default",
                            showCorrect && "border-success/50 bg-success/10 text-success",
                            isWrong && "border-destructive/50 bg-destructive/10 text-destructive",
                            !showCorrect && !isWrong && "border-border-subtle text-foreground-muted opacity-60",
                          ],
                        )}
                      >
                        <span className="shrink-0 w-4 font-medium uppercase text-xs mt-0.5">
                          {opt.id}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {isReview && showCorrect && <CheckCircle2 className="size-4 shrink-0 mt-0.5" aria-hidden />}
                        {isReview && isWrong && <XCircle className="size-4 shrink-0 mt-0.5" aria-hidden />}
                      </button>
                    );
                  })}
                </div>

                {isReview && q.explanation && (
                  <div className="rounded-xl bg-surface-raised px-3 py-2 text-xs text-foreground-muted">
                    <span className="font-medium text-foreground">Giải thích: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit */}
        {!isReview && (
          <div className="space-y-2">
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <Button
              type="button"
              disabled={!allAnswered || quizState === "submitting"}
              onClick={() => void handleSubmit()}
            >
              {quizState === "submitting"
                ? "Đang nộp…"
                : allAnswered
                  ? `Nộp bài (${answeredCount}/${questions.length})`
                  : `Trả lời tất cả câu hỏi (${answeredCount}/${questions.length})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
