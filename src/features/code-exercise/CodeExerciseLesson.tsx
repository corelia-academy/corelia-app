import { useLearningConfirm } from "@/features/learning/useLearningConfirm";
import { normalizeCodeLocale } from "./locale";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  return <Exercise key={`${props.courseId}:${props.lesson.id}:${config.revision}:${user?.id}:${props.mode}:${props.draftEpoch ?? 0}`} {...props} config={config} userId={user?.id} />;
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
  const [tab, setTab] = useState("code");
  const segments = useMemo(() => config.mode === "fill" ? parseMarkers(config.file.starter_source) : [], [config]);
  const lines = useMemo(() => { const out = segments.reduce<FillSegment[][]>((acc, s) => {
    if (s.type === "blank") { acc[acc.length - 1].push(s); return acc; }
    s.value.split("\n").forEach((part, i) => { if (i) acc.push([]); if (part) acc[acc.length - 1].push({ type: "source", value: part }); });
    return acc;
  }, [[]]); if (out.length > 1 && !out[out.length - 1].length) out.pop(); return out; }, [segments]);
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
    {config.mode === "edit" && <><p className="text-sm text-foreground-muted lg:hidden">{t("learning.desktopRecommended")}</p><div className="flex gap-2 lg:hidden" role="group">{["code", "tests"].map(value => <Button type="button" key={value} variant="cta" hierarchy={(tab === value ? "primary" : "secondary")} onClick={() => setTab(value)}>{t(`learning.${value}`)}</Button>)}</div></>}
    <div className={config.mode === "edit" ? "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" : "space-y-4"}>
      <div className={config.mode === "edit" && tab !== "code" ? "hidden lg:block" : "min-w-0"}>
        {config.mode === "fill" ? <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
          <p className="border-b border-border-subtle px-4 py-2 font-mono text-xs text-foreground-muted">{config.file.path}</p>
          <pre className="overflow-x-auto py-3 font-mono text-sm leading-9 max-sm:leading-[2.75rem]">{lines.map((line, n) => <div key={n} className="flex min-h-9 max-sm:min-h-11">
            <span aria-hidden="true" className="w-10 shrink-0 select-none pr-3 text-right text-foreground-subtle">{n + 1}</span>
            <code className="whitespace-pre pr-4">{line.map((s, i) => {
              if (s.type === "source") return <span key={i}>{s.value}</span>;
              const value = answers[s.id] ?? "";
              const passed = result?.results.find(r => r.test_id === s.id)?.passed;
              return <input key={s.id} disabled={busy} aria-label={s.id} aria-invalid={passed === false} value={value} placeholder="…" spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" style={{ width: `calc(${Math.max(6, value.length + 1)}ch + 1rem)` }} onChange={e => { setAnswers(a => ({ ...a, [s.id]: e.target.value.slice(0, 1024) })); setResult(null); setError(null); setCompletionPending(false); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); void check(); } }} className={cn("mx-0.5 h-8 max-w-full rounded-md border border-dashed px-2 align-middle font-mono text-sm text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus:border-solid focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 max-sm:h-10", passed === undefined ? "border-primary/40 bg-surface-base" : passed ? "border-solid border-success bg-success/10" : "border-solid border-destructive bg-destructive/10")} />;
            })}</code>
          </div>)}</pre>
        </div> : <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised"><p className="border-b border-border-subtle px-4 py-2 font-mono text-xs text-foreground-muted">{config.file.path}</p><CodeEditor language={config.language} source={source} readOnly={busy} onChange={value => { if (sourceBytes(value) <= MAX_SOURCE_BYTES) { setSource(value); setResult(null); setError(null); setCompletionPending(false); } else setError(t("learning.sourceLimit")); }} /></div>}
      </div>
      <div aria-live="polite" className={cn(config.mode === "edit" && tab !== "tests" ? "hidden lg:block" : "space-y-2", config.mode === "edit" && "lg:sticky lg:top-4 lg:self-start lg:max-h-[70vh] lg:overflow-y-auto")}>
        <h3 className="font-medium">{t("learning.tests")}</h3>
        {result ? <><p className={cn("font-medium", result.passed ? "text-success" : "text-destructive")}>{t(result.passed ? "learning.passed" : "learning.failed")}</p>{[...result.results].sort((a,b) => Number(b.required)-Number(a.required)).map(r => <div key={r.test_id} className={cn("space-y-1 rounded-lg border p-3 text-sm", r.passed ? "border-success/25 bg-success/10" : "border-destructive/30 bg-destructive/10")}><p className="font-medium"><span aria-hidden="true" className={r.passed ? "text-success" : "text-destructive"}>{r.passed ? "✓" : "✕"}</span> {copy.test_copy?.[r.test_id]?.description ?? r.description}</p>{!r.passed && <p className="text-foreground-muted">{copy.blank_feedback?.[r.test_id] ?? copy.test_copy?.[r.test_id]?.failure_message ?? r.message}</p>}{!r.passed && r.hint && <p className="text-foreground-muted">{copy.test_copy?.[r.test_id]?.hint ?? r.hint}</p>}</div>)}</> : <p className="text-foreground-muted">{t("learning.checkPrompt")}</p>}
      </div>
    </div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {confirmation}<Button type="button" variant="cta" hierarchy="secondary" disabled={busy} onClick={reset}>{t("learning.reset")}</Button>
      <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setHints(v => !v)}>{t("learning.hints")}</Button>
      <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setSolution(v => !v)}>{t("learning.solution")}</Button>
      {key && saved !== null && <span role="status" className="text-xs text-foreground-muted">{t(saved ? "learning.draftSaved" : "learning.draftUnavailable")}</span>}
    </div>
    {hints && <ul className="list-disc space-y-1 rounded-xl border border-border-subtle bg-surface-raised py-3 pl-8 pr-4 text-sm">{(copy.hints ?? config.hints ?? []).map((hint,i) => <li key={i}>{hint}</li>)}</ul>}
    {solution && <pre className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised p-4 font-mono text-sm leading-6">{config.reference_solution}</pre>}
  </div>;
}
