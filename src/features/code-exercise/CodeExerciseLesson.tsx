import { useLearningConfirm } from "@/features/learning/useLearningConfirm";
import { normalizeCodeLocale } from "./locale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { recordLearningEvent } from "@/lib/learning";
import type { LessonRendererProps } from "@/features/learning/types";
import { CodeEditor } from "./CodeEditor";
import { validateCodeConfig } from "./config";
import { evaluateCodeExercise, MAX_SOURCE_BYTES, sourceBytes } from "./evaluate";
import { codeDraftKey, readCodeDraft, saveCodeDraft } from "./drafts";
import { parseMarkers } from "./markers";
import type { CodeExerciseConfig, CodeExerciseResult } from "./types";

export function CodeExerciseLesson(props: LessonRendererProps) {
  const { user } = useAuth();
  const { t } = useLearningTranslation();
  const config = props.lesson.code_exercise_config;
  if (validateCodeConfig(config).length || !config) return <p role="alert">{t("learning.unavailable")}</p>;
  return <Exercise key={`${props.courseId}:${props.lesson.id}:${config.revision}:${user?.id}:${props.mode}`} {...props} config={config} userId={user?.id} />;
}
function Exercise({ lesson, courseId, config, userId, mode, completed, onComplete, onAction }: LessonRendererProps & { config: CodeExerciseConfig; userId?: string }) {
  const { t } = useLearningTranslation();
  const copy = normalizeCodeLocale(lesson.code_exercise_locale).value;
  const key = mode === "learner" && userId ? codeDraftKey(userId, courseId, lesson.id, config.revision) : null;
  const [restored] = useState(() => key ? readCodeDraft(key) : null);
  const [source, setSource] = useState(restored?.mode === "edit" ? restored.source : config.file.starter_source);
  const [answers, setAnswers] = useState<Record<string, string>>(restored?.mode === "fill" ? restored.answers : {});
  const [result, setResult] = useState<CodeExerciseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [solution, setSolution] = useState(false);
  const [hints, setHints] = useState(false);
  const [tab, setTab] = useState("code");
  const segments = useMemo(() => config.mode === "fill" ? parseMarkers(config.file.starter_source) : [], [config]);
  const save = useCallback(() => {
    if (!key) return;
    setSaved(saveCodeDraft(key, config.mode === "fill" ? { mode: "fill", answers, updated_at: new Date().toISOString() } : { mode: "edit", source, updated_at: new Date().toISOString() }));
  }, [key, config.mode, answers, source]);
  useEffect(() => {
    if (!key) return;
    const persist = () => saveCodeDraft(key, config.mode === "fill" ? { mode: "fill", answers, updated_at: new Date().toISOString() } : { mode: "edit", source, updated_at: new Date().toISOString() });
    const timer = setTimeout(() => setSaved(persist()), 350);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [key, config.mode, answers, source]);
  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      if (completionPending) {
        await onComplete();
        setCompletionPending(false);
        return;
      }
      const evaluated = evaluateCodeExercise(config, { answers, source });
      setResult(evaluated);
      if (key) void recordLearningEvent(courseId, lesson.id, "code_exercise_checked", evaluated.passed);
      if (evaluated.passed && mode === "learner" && !completed) {
        setCompletionPending(true);
        await onComplete();
        setCompletionPending(false);
      }
    } catch { setError(t("learning.systemError")); }
    finally { inFlight.current = false; setBusy(false); }
  }, [config, answers, source, key, courseId, lesson.id, mode, completed, completionPending, onComplete, t]);
  useEffect(() => { onAction({ label: t(busy ? "learning.checking" : completionPending ? "learning.retryProgress" : "learning.checkCode"), disabled: busy, pending: busy, run: check }); return () => onAction(null); }, [onAction, check, busy, completionPending, t]);
  const { confirm, confirmation } = useLearningConfirm();
  async function reset() {
    if ((source !== config.file.starter_source || Object.values(answers).some(Boolean)) && !await confirm(t("learning.resetConfirm"))) return;
    setSource(config.file.starter_source); setAnswers({}); setResult(null); setError(null); setCompletionPending(false);
  }
  return <div className="space-y-4" onKeyDown={e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void check(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  }}>
    {config.mode === "edit" && <><p className="text-sm text-foreground-muted lg:hidden">{t("learning.desktopRecommended")}</p><div className="flex gap-2 lg:hidden">{["code", "tests"].map(value => <Button type="button" key={value} variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>{t(`learning.${value}`)}</Button>)}</div></>}
    <div className={config.mode === "edit" ? "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" : "space-y-4"}>
      <div className={config.mode === "edit" && tab !== "code" ? "hidden lg:block" : "min-w-0"}>
        <p className="mb-2 text-sm font-mono">{config.file.path}</p>
        {config.mode === "fill" ? <pre className="overflow-x-auto whitespace-pre rounded-lg border border-border p-4 font-mono text-sm leading-9">{segments.map((s, i) => s.type === "source" ? <span key={i}>{s.value}</span> : <input key={s.id} disabled={busy} aria-label={s.id} aria-invalid={result?.results.find(r => r.test_id === s.id)?.passed === false} value={answers[s.id] ?? ""} onChange={e => { setAnswers(a => ({ ...a, [s.id]: e.target.value.slice(0, 1024) })); setResult(null); setError(null); setCompletionPending(false); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); void check(); } }} className="mx-1 min-h-11 w-28 rounded border border-border bg-surface-raised px-2 font-mono" />)}</pre> : <CodeEditor source={source} readOnly={busy} onChange={value => { if (sourceBytes(value) <= MAX_SOURCE_BYTES) { setSource(value); setResult(null); setError(null); setCompletionPending(false); } else setError(t("learning.sourceLimit")); }} />}
      </div>
      <div aria-live="polite" className={config.mode === "edit" && tab !== "tests" ? "hidden lg:block" : "space-y-2"}>
        <h3 className="font-medium">{t("learning.tests")}</h3>
        {result ? <><p className={result.passed ? "text-success" : "text-destructive"}>{t(result.passed ? "learning.passed" : "learning.failed")}</p>{[...result.results].sort((a,b) => Number(b.required)-Number(a.required)).map(r => <div key={r.test_id} className="rounded-lg border border-border p-3 text-sm"><p>{r.passed ? "✓" : "✕"} {copy.test_copy?.[r.test_id]?.description ?? r.description}</p>{!r.passed && <p>{copy.blank_feedback?.[r.test_id] ?? copy.test_copy?.[r.test_id]?.failure_message ?? r.message}</p>}{!r.passed && r.hint && <p>{copy.test_copy?.[r.test_id]?.hint ?? r.hint}</p>}</div>)}</> : <p className="text-foreground-muted">{t("learning.checkPrompt")}</p>}
      </div>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {confirmation}<Button type="button" variant="outline" disabled={busy} onClick={reset}>{t("learning.reset")}</Button>
      <Button type="button" variant="ghost" onClick={() => setHints(v => !v)}>{t("learning.hints")}</Button>
      <Button type="button" variant="ghost" onClick={() => setSolution(v => !v)}>{t("learning.solution")}</Button>
      {key && saved !== null && <span role="status" className="text-xs text-foreground-muted">{t(saved ? "learning.draftSaved" : "learning.draftUnavailable")}</span>}
    </div>
    {hints && <ul className="list-disc pl-5">{(copy.hints ?? config.hints ?? []).map((hint,i) => <li key={i}>{hint}</li>)}</ul>}
    {solution && <pre className="overflow-x-auto rounded-lg bg-surface-raised p-4 text-sm">{config.reference_solution}</pre>}
  </div>;
}
