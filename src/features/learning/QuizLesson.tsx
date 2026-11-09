import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExplanationBox } from "@/components/ui/explanation-box";
import { ProgressCircle } from "@/components/ui/progress";
import { RadioCard } from "@/components/ui/selection";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import { getLearningQuiz, submitLearningQuiz, type LearningQuizResult } from "@/lib/learning";
import { LessonConfetti } from "./LessonConfetti";
import type { LessonRendererProps } from "./types";
import type { SectionQuestion } from "@/types/questions";

export function QuizLesson(props: LessonRendererProps & { questions?: SectionQuestion[] }) {
  const { user } = useAuth();
  const { t, i18n } = useLearningTranslation();
  const locale = props.contentLocale ?? i18n.language;
  const query = useQuery({ queryKey: ["learning-quiz", props.courseId, props.lesson.id, props.mode, user?.id, locale, props.resetEpoch ?? 0], queryFn: ({ signal }) => getLearningQuiz(props.courseId, props.lesson.id, props.mode === "preview" ? undefined : user?.id, locale, signal), enabled: !props.questions, staleTime: 30_000 });
  if (!props.questions && query.isPending) return <div role="status" aria-busy="true" className="space-y-3"><span className="sr-only">{t("learning.loading")}</span><Skeleton className="h-6 w-1/2" /><Skeleton className="h-24 w-full rounded-xl" /></div>;
  if (!props.questions && query.isError) return <div role="alert">{t("learning.loadError")} <Button type="button" onClick={() => void query.refetch()}>{t("learning.retry")}</Button></div>;
  const questions = props.questions ?? query.data?.questions ?? [];
  if (!questions.length) return <p role="alert">{t("learning.unavailable")}</p>;
  return <Quiz key={`${props.courseId}:${props.lesson.id}:${props.mode}:${user?.id}:${locale}:${props.resetEpoch ?? 0}`} {...props} questions={questions} initial={props.questions ? null : query.data?.result ?? null} />;
}
function Quiz({ courseId, lesson, mode, completed, onComplete, onAction, questions, initial, resetEpoch = 0 }: LessonRendererProps & { questions: SectionQuestion[]; initial: LearningQuizResult | null }) {
  const { t } = useLearningTranslation();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number>>(() => Object.fromEntries((initial?.attempts ?? []).map(a => [a.question_id, a.selected_index])));
  const [result, setResult] = useState(initial);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number> | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingId, setMissingId] = useState<string | null>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const allAnswered = questions.every(q => answers[q.id] !== undefined);
  const locked = busy || Boolean(result) || submittedAnswers !== null;
  const retry = useCallback(() => { setAnswers({}); setSubmittedAnswers(null); setResult(null); setError(null); setMissingId(null); setRequestId(crypto.randomUUID()); }, []);
  const submit = useCallback(async () => {
    if (inFlight.current) return;
    if (!allAnswered && !result) {
      const first = questions.find(q => answers[q.id] === undefined);
      if (first) {
        setMissingId(first.id);
        document.getElementById(`${first.id}-question`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      // A successful RPC has already committed the attempt. Retry only the
      // progress/cache synchronization if that subsequent step failed.
      if (result?.passed && mode === "learner") {
        if (!completed) await onComplete();
        return;
      }
      const threshold = lesson.quiz_config?.passing_ratio ?? 0.7;
      const payload = submittedAnswers ?? { ...answers };
      setSubmittedAnswers(payload);
      const correct = questions.filter(q => q.correct_index === payload[q.id]).length;
      const value: LearningQuizResult = mode === "preview" ? { total: questions.length, correct, passed: correct / questions.length >= threshold, passing_ratio: threshold, attempt_group_id: requestId, completed: true, attempts: [] } : await submitLearningQuiz(courseId, lesson.id, requestId, payload, resetEpoch);
      setResult(value);
      if (value.passed) setCelebrateKey(k => k + 1);
      if (value.passed && mode === "learner" && !completed) await onComplete();
    } catch (e) { setError(e instanceof Error ? e.message : t("learning.systemError")); }
    finally { inFlight.current = false; setBusy(false); }
  }, [allAnswered, lesson.id, lesson.quiz_config, questions, answers, submittedAnswers, mode, requestId, courseId, completed, onComplete, result, resetEpoch, t]);
  useEffect(() => {
    onAction({ label: t(busy ? "learning.checking" : result?.passed && mode === "learner" ? "learning.completeContinue" : error || (result && !result.passed) ? "learning.retry" : "learning.checkAnswers"), disabled: busy || (mode === "learner" && !user), pending: busy,
      summary: { correct: result?.correct ?? 0, total: result?.total ?? questions.length, passed: result?.passed },
      run: result && !result.passed ? retry : submit });
    return () => onAction(null);
  }, [onAction, busy, result, error, mode, user, retry, submit, t, questions.length]);
  return <div className="relative space-y-6">
    <LessonConfetti burstKey={celebrateKey} />
    {mode === "learner" && !user && <p>{t("learning.loginToSave")}</p>}
    <div className="flex flex-col gap-10">
      {questions.map((q, i) => {
        const picked = answers[q.id];
        const right = picked === q.correct_index;
        return <fieldset key={q.id} disabled={locked} className="flex min-w-0 flex-col gap-3xl border-0 p-0">
          <div className="flex flex-col gap-xl">
            <div className="flex items-center gap-lg">
              <Badge size="medium" color="gray" variant="filled" className="h-8">{t("learning.questionNumber", { number: i + 1 })}</Badge>
              <span className="text-body-medium text-foreground-subtle">{t("learning.quizType.mcq")}</span>
            </div>
            <p id={`${q.id}-question`} className="text-body-large text-action-text">{q.question}</p>
          </div>
          <RadioGroup aria-labelledby={`${q.id}-question`} value={picked === undefined ? "" : String(picked)} readOnly={locked}
            onValueChange={value => setAnswers(a => ({ ...a, [q.id]: Number(value) }))} className="flex flex-col gap-lg">
            {q.options.map((o, index) => {
              const mark = result ? (index === q.correct_index ? "done" : picked === index ? "failed" : null) : null;
              return <div key={o.id} className="relative">
                <RadioCard appearance="answer" size="large" value={String(index)} label={o.text} disabled={Boolean(result) && index !== q.correct_index} className={cn(mark && "pr-12")} />
                {mark && <ProgressCircle className="pointer-events-none absolute right-lg top-1/2 size-5 -translate-y-1/2"
                  done={mark === "done"} failed={mark === "failed"} aria-label={t(mark === "done" ? "learning.quizAnswerCorrect" : "learning.quizAnswerWrong")} />}
              </div>;
            })}
          </RadioGroup>
          {missingId === q.id && picked === undefined && <p role="alert" className="text-body-medium text-input-field-error">{t("learning.quizPleaseAnswer")}</p>}
          {result && <ExplanationBox status={right ? "correct" : "incorrect"} title={t(right ? "learning.quizCorrect" : "learning.quizThinkAgain")}
            statusLabel={t(right ? "learning.quizAnswerCorrect" : "learning.quizAnswerWrong")}>{q.explanation}</ExplanationBox>}
        </fieldset>;
      })}
    </div>
    {error && !result && submittedAnswers && <p className="text-sm text-foreground-muted">{t("learning.quizRetrySameAnswers")}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
