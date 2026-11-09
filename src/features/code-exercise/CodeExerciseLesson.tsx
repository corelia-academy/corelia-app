import { normalizeCodeLocale } from "./locale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressCircle } from "@/components/ui/progress";
import { CodeBlock, CodeBlockFrame, CodeSpan } from "@/components/markdown/CodeBlock";
import { ExplanationBox } from "@/components/ui/explanation-box";
import { useAuth } from "@/stores/authStore";
import { recordLearningEvent } from "@/lib/learning";
import type { LessonRendererProps } from "@/features/learning/types";
import { CodeEditor } from "./CodeEditor";
import { validateCodeConfig } from "./config";
import { evaluateCodeExercise, MAX_SOURCE_BYTES, sourceBytes } from "./evaluate";
import { codeDraftKey, readCodeDraft, saveCodeDraft } from "./drafts";
import { parseMarkers, type FillSegment } from "./markers";
import type { CodeExerciseConfig, CodeExerciseResult } from "./types";

export function CodeExerciseLesson(props: LessonRendererProps) {
  const { user } = useAuth();
  const { t } = useLearningTranslation();
  const config = props.lesson.code_exercise_config;
  if (validateCodeConfig(config).length || !config) return <p role="alert">{t("learning.unavailable")}</p>;
  return <Exercise key={`${props.courseId}:${props.lesson.id}:${config.revision}:${user?.id}:${props.mode}:${props.draftEpoch ?? 0}:${props.resetEpoch ?? 0}`} {...props} config={config} userId={user?.id} />;
}
function Exercise({ lesson, courseId, config, userId, mode, completed, onComplete, onAction, draftEpoch = 0 }: LessonRendererProps & { config: CodeExerciseConfig; userId?: string }) {
  const { t } = useLearningTranslation();
  const copy = normalizeCodeLocale(lesson.code_exercise_locale).value;
  const key = mode === "learner" && userId ? `${codeDraftKey(userId, courseId, lesson.id, config.revision)}${draftEpoch ? `:${draftEpoch}` : ""}` : null;
  useEffect(() => {
    if (!key || !userId || !draftEpoch) return;
    const previous = `${codeDraftKey(userId, courseId, lesson.id, config.revision)}${draftEpoch > 1 ? `:${draftEpoch - 1}` : ""}`;
    try { localStorage.removeItem(previous); } catch { /* A blocked store cannot prevent a fresh draft. */ }
  }, [key, userId, courseId, lesson.id, config.revision, draftEpoch]);
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
  const segments = useMemo(() => config.mode === "fill" ? parseMarkers(config.file.starter_source) : [], [config]);
  const lines = useMemo(() => { const out = segments.reduce<FillSegment[][]>((acc, s) => {
    if (s.type === "blank") { acc[acc.length - 1].push(s); return acc; }
    s.value.split("\n").forEach((part, i) => { if (i) acc.push([]); if (part) acc[acc.length - 1].push({ type: "source", value: part }); });
    return acc;
  }, [[]]); if (out.length > 1 && !out[out.length - 1].length) out.pop(); return out; }, [segments]);
  const fill = config.mode === "fill";
  const blankIds = useMemo(() => segments.flatMap(s => s.type === "blank" ? [s.id] : []), [segments]);
  const [missingId, setMissingId] = useState<string | null>(null);
  const locked = result !== null;
  const retryable = result !== null && !result.passed;
  const notes = result ? result.results.filter(r => !r.passed).flatMap(r => [
    ...(fill ? [] : [copy.test_copy?.[r.test_id]?.description ?? r.description]),
    copy.blank_feedback?.[r.test_id] ?? copy.test_copy?.[r.test_id]?.failure_message ?? r.message,
    copy.test_copy?.[r.test_id]?.hint ?? r.hint,
  ]).filter((note): note is string => Boolean(note)) : [];
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
    if (fill && !completionPending) {
      const empty = blankIds.find(id => !(answers[id] ?? "").trim());
      if (empty) {
        setMissingId(empty);
        const input = document.querySelector<HTMLInputElement>(`[data-blank="${empty}"]`);
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
        input?.focus({ preventScroll: true });
        return;
      }
    }
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
  }, [config, fill, blankIds, answers, source, key, courseId, lesson.id, mode, completed, completionPending, onComplete, t]);
  const retry = useCallback(() => { setResult(null); setMissingId(null); setError(null); setCompletionPending(false); }, []);
  const act = retryable ? retry : check;
  useEffect(() => { onAction({
    label: t(busy ? "learning.checking" : completionPending ? "learning.retryProgress" : retryable ? "learning.retry" : "learning.checkCode"),
    disabled: busy, pending: busy,
    run: act,
  }); return () => onAction(null); }, [onAction, act, busy, completionPending, retryable, t]);
  return <div className="space-y-4" onKeyDown={e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void act(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  }}>
    <div className="space-y-4">
      <div className="min-w-0">
        {config.mode === "fill" ? <CodeBlockFrame language={config.language}>
          <div className="flex flex-col gap-xl overflow-x-auto p-2xl font-mono text-[16px] leading-none tracking-[-0.01em] text-foreground">
            {lines.map((line, n) => <div key={n} className="flex items-center gap-2xl">
              <span aria-hidden="true" className="shrink-0 select-none text-neutral-500" style={{ width: `${String(lines.length).length}ch` }}>{n + 1}</span>
              <code className="flex items-center gap-[10px] whitespace-pre">{line.map((s, i) => {
                if (s.type === "source") return <CodeSpan key={i} code={s.value} language={config.language} />;
                const value = answers[s.id] ?? "";
                const passed = result?.results.find(r => r.test_id === s.id)?.passed;
                // The hidden mirror has the same font and padding as the input, so the field grows to fit its text exactly.
                return <span key={s.id} className="inline-grid min-w-[140px] max-w-full shrink-0">
                  <span aria-hidden="true" className={`invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-pre border border-transparent pl-3 font-body text-body-large leading-[1.4] tracking-[0.02em] ${passed ? "pr-10" : "pr-3"}`}>{value}{" "}</span>
                  <Input aria-label={s.id} data-blank={s.id} value={value} disabled={busy} readOnly={locked} aria-invalid={passed === false}
                    statusIcon={passed ? <ProgressCircle done className="size-5" aria-label={t("learning.quizAnswerCorrect")} /> : undefined}
                    controlClassName="col-start-1 row-start-1 w-full" className="w-0" spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off"
                    onChange={e => { setAnswers(a => ({ ...a, [s.id]: e.target.value.slice(0, 1024) })); setResult(null); setError(null); setCompletionPending(false); }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); void act(); } }} />
                </span>;
              })}</code>
            </div>)}
          </div>
        </CodeBlockFrame> : <CodeBlockFrame language={config.language}><CodeEditor language={config.language} source={source} readOnly={busy || locked} onChange={value => { if (sourceBytes(value) <= MAX_SOURCE_BYTES) { setSource(value); setResult(null); setError(null); setCompletionPending(false); } else setError(t("learning.sourceLimit")); }} /></CodeBlockFrame>}
        {fill && missingId && !(answers[missingId] ?? "").trim() && <p role="alert" className="mt-lg text-body-medium text-input-field-error">{t("learning.codeFillAll")}</p>}
        <div aria-live="polite">{result && <ExplanationBox className="mt-6xl" status={result.passed ? "correct" : "incorrect"}
          title={t(result.passed ? "learning.quizCorrect" : "learning.quizThinkAgain")}
          statusLabel={t(result.passed ? "learning.quizAnswerCorrect" : "learning.quizAnswerWrong")}>
        {notes.length ? <ul className="flex list-disc flex-col gap-sm pl-5">{notes.map((note, i) => <li key={i}>{note}</li>)}</ul> : undefined}
      </ExplanationBox>}</div>
      </div>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setHints(v => !v)}>{t("learning.hints")}</Button>
      <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setSolution(v => !v)}>{t("learning.solution")}</Button>
      {key && saved !== null && <span role="status" className="text-xs text-foreground-muted">{t(saved ? "learning.draftSaved" : "learning.draftUnavailable")}</span>}
    </div>
    {hints && <ul className="list-disc space-y-1 rounded-xl border border-border-subtle bg-surface-raised py-3 pl-8 pr-4 text-sm">{(copy.hints ?? config.hints ?? []).map((hint,i) => <li key={i}>{hint}</li>)}</ul>}
    {solution && <CodeBlock language={config.language} code={config.reference_solution} copyable={false} header={false} />}
  </div>;
}
