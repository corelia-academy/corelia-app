import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitSectionQuizAttempts } from "@/lib/quizAttempts";
import type { SectionQuestion, SectionQuizResult } from "@/types/questions";

type Props = {
  courseId: string;
  sectionId: string;
  sectionTitle: string;
  questions: SectionQuestion[];
  existingResult: SectionQuizResult | null;
  onResultUpdate: (result: SectionQuizResult) => void;
};

type QuizState = "idle" | "submitting" | "done";

export function SectionQuiz({
  courseId,
  sectionId,
  sectionTitle,
  questions,
  existingResult,
  onResultUpdate,
}: Props) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SectionQuizResult | null>(existingResult);
  const [quizState, setQuizState] = useState<QuizState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (questions.length === 0) return null;

  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = answeredCount === questions.length;

  async function handleSubmit() {
    if (!allAnswered || quizState === "submitting") return;
    setQuizState("submitting");
    setSubmitError(null);
    try {
      const attempts = questions.map((q) => ({
        courseId,
        sectionId,
        questionId: q.id,
        selectedIndex: selectedAnswers[q.id] ?? 0,
        isCorrect: (selectedAnswers[q.id] ?? -1) === q.correct_index,
      }));
      const saved = await submitSectionQuizAttempts(attempts);
      const correct = saved.filter((a) => a.is_correct).length;
      const newResult: SectionQuizResult = {
        section_id: sectionId,
        total: questions.length,
        correct,
        completed: true,
        attempts: saved,
      };
      setResult(newResult);
      onResultUpdate(newResult);
      setQuizState("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Không thể lưu kết quả.");
      setQuizState("idle");
    }
  }

  function handleRetry() {
    setSelectedAnswers({});
    setResult(null);
    setQuizState("idle");
    setSubmitError(null);
  }

  const displayResult = quizState === "done" ? result : null;
  const reviewMap = displayResult
    ? new Map(displayResult.attempts.map((a) => [a.question_id, a]))
    : null;

  const scorePercent = displayResult
    ? Math.round((displayResult.correct / displayResult.total) * 100)
    : null;

  return (
    <div className="border-t border-border-subtle px-4 pb-8 pt-6 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Bài kiểm tra: {sectionTitle}
          </h2>
          <p className="text-sm text-foreground-muted">
            {questions.length} câu hỏi trắc nghiệm về nội dung chương này.
          </p>
        </div>

        {/* Score banner */}
        {displayResult && scorePercent !== null && (
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3",
              scorePercent >= 70
                ? "border-success/30 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            <Trophy className="size-5 shrink-0" aria-hidden />
            <div className="flex-1">
              <p className="font-medium text-sm">
                {displayResult.correct}/{displayResult.total} câu đúng ({scorePercent}%)
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {scorePercent >= 70
                  ? "Tốt lắm! Bạn đã nắm vững nội dung chương này."
                  : "Hãy xem lại bài học và thử lại nhé!"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className="shrink-0"
            >
              <RotateCcw className="size-3.5 mr-1.5" aria-hidden />
              Làm lại
            </Button>
          </div>
        )}

        {/* Question list */}
        <div className="space-y-5">
          {questions.map((q, qi) => {
            const attempt = reviewMap?.get(q.id);
            const selected = selectedAnswers[q.id];
            const isReview = !!reviewMap;

            return (
              <div key={q.id} className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  <span className="text-foreground-muted mr-1.5">{qi + 1}.</span>
                  {q.question}
                </p>

                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = selected === oi || attempt?.selected_index === oi;
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
                          setSelectedAnswers((prev) => ({ ...prev, [q.id]: oi }));
                        }}
                        className={cn(
                          "w-full flex items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors",
                          !isReview && [
                            "hover:bg-surface-raised cursor-pointer",
                            selected === oi
                              ? "border-primary bg-primary/5 text-foreground"
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
                        {isReview && showCorrect && (
                          <CheckCircle2 className="size-4 shrink-0 mt-0.5" aria-hidden />
                        )}
                        {isReview && isWrong && (
                          <XCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation — show after review */}
                {isReview && q.explanation && (
                  <div className="rounded-md bg-surface-raised px-3 py-2 text-xs text-foreground-muted">
                    <span className="font-medium text-foreground">Giải thích: </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit / error */}
        {!displayResult && (
          <div className="space-y-2">
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <Button
              type="button"
              disabled={!allAnswered || quizState === "submitting"}
              onClick={handleSubmit}
            >
              {quizState === "submitting"
                ? "Đang nộp..."
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
