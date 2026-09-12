import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { getLearningQuiz, submitLearningQuiz, type LearningQuizResult } from "@/lib/learning";
import type { LessonRendererProps } from "./types";
import type { SectionQuestion } from "@/types/questions";

export function QuizLesson(props: LessonRendererProps & { questions?: SectionQuestion[] }) {
  const { user } = useAuth();
  const { t, i18n } = useLearningTranslation();
  const locale = props.contentLocale ?? i18n.language;
  const query = useQuery({ queryKey: ["learning-quiz", props.courseId, props.lesson.id, props.mode, user?.id, locale], queryFn: ({ signal }) => getLearningQuiz(props.courseId, props.lesson.id, props.mode === "preview" ? undefined : user?.id, locale, signal), enabled: !props.questions, staleTime: 30_000 });
  if (!props.questions && query.isPending) return <p role="status">{t("learning.loading")}</p>;
  if (!props.questions && query.isError) return <div role="alert">{t("learning.loadError")} <Button type="button" onClick={() => void query.refetch()}>{t("learning.retry")}</Button></div>;
  const questions = props.questions ?? query.data?.questions ?? [];
  if (!questions.length) return <p role="alert">{t("learning.unavailable")}</p>;
  return <Quiz key={`${props.courseId}:${props.lesson.id}:${props.mode}:${user?.id}:${locale}`} {...props} questions={questions} initial={props.questions ? null : query.data?.result ?? null} />;
}
function Quiz({ courseId, lesson, mode, completed, onComplete, onAction, questions, initial }: LessonRendererProps & { questions: SectionQuestion[]; initial: LearningQuizResult | null }) {
  const { t } = useLearningTranslation();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, number>>(() => Object.fromEntries((initial?.attempts ?? []).map(a => [a.question_id, a.selected_index])));
  const [result, setResult] = useState(initial);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number> | null>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allAnswered = questions.every(q => answers[q.id] !== undefined);
  const allowRetry = lesson.quiz_config?.allow_retry !== false;
  const retry = useCallback(() => { setAnswers({}); setSubmittedAnswers(null); setResult(null); setError(null); setRequestId(crypto.randomUUID()); }, []);
  const submit = useCallback(async () => {
    if (inFlight.current || (!allAnswered && !result?.passed)) return;
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
      const value: LearningQuizResult = mode === "preview" ? { total: questions.length, correct, passed: correct / questions.length >= threshold, passing_ratio: threshold, attempt_group_id: requestId, completed: true, attempts: [] } : await submitLearningQuiz(courseId, lesson.id, requestId, payload);
      setResult(value);
      if (value.passed && mode === "learner" && !completed) await onComplete();
    } catch (e) { setError(e instanceof Error ? e.message : t("learning.systemError")); }
    finally { inFlight.current = false; setBusy(false); }
  }, [allAnswered, lesson.id, lesson.quiz_config, questions, answers, submittedAnswers, mode, requestId, courseId, completed, onComplete, result, t]);
  useEffect(() => {
    onAction({ label: t(busy ? "learning.checking" : result?.passed && mode === "learner" ? "learning.completeContinue" : error || (result && !result.passed) ? "learning.retry" : "learning.checkAnswers"), disabled: busy || (!allAnswered && !result) || (!!result && !result.passed && !allowRetry) || (mode === "learner" && !user), pending: busy, run: result && !result.passed ? retry : submit });
    return () => onAction(null);
  }, [onAction, busy, result, error, allAnswered, allowRetry, mode, user, retry, submit, t]);
  return <div className="space-y-6">
    {mode === "learner" && !user && <p>{t("learning.loginToSave")}</p>}
    {result && <div role="status" className="rounded-xl border border-border p-4"><p>{result.correct}/{result.total} · {Math.round(result.correct / result.total * 100)}% · {t(result.passed ? "learning.passed" : "learning.failed")}</p></div>}
    {questions.map((q,i) => <fieldset key={q.id} disabled={busy || Boolean(result) || submittedAnswers !== null} className="space-y-2"><legend className="mb-2 font-medium">{i+1}. {q.question}</legend>{q.options.map((o,index) => <label key={o.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3"><input type="radio" disabled={busy || Boolean(result) || submittedAnswers !== null} name={q.id} checked={answers[q.id] === index} onChange={() => setAnswers(a => ({ ...a, [q.id]: index }))} /><span>{o.text}</span>{result && index === q.correct_index && <span>✓</span>}{result && answers[q.id] === index && index !== q.correct_index && <span>✕</span>}</label>)}{result && q.explanation && <p className="text-sm text-foreground-muted">{q.explanation}</p>}</fieldset>)}
    {error && !result && submittedAnswers && <p className="text-sm text-foreground-muted">{t("learning.quizRetrySameAnswers")}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </div>;
}
