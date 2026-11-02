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
import type { CodeExerciseConfig, CodeExerciseResult, CodeExerciseTwoStageConfig } from "./types";

export function CodeExerciseLesson(props: LessonRendererProps) {
  const { user } = useAuth();
  const { t } = useLearningTranslation();
  const config = props.lesson.code_exercise_config;
  if (!config || validateCodeConfig(config).length) return <p role="alert">{t("learning.unavailable")}</p>;
  if (config.mode === "two_stage") {
    return <TwoStageExercise key={`${props.courseId}:${props.lesson.id}:${config.revision}:${user?.id}:${props.mode}:${props.draftEpoch ?? 0}`} {...props} config={config} userId={user?.id} />;
  }
  return <Exercise key={`${props.courseId}:${props.lesson.id}:${config.revision}:${user?.id}:${props.mode}:${props.draftEpoch ?? 0}`} {...props} config={config} userId={user?.id} />;
}

function TwoStageExercise({ lesson, courseId, config, userId, mode, completed, onComplete, onAction, draftEpoch = 0 }: LessonRendererProps & { config: CodeExerciseTwoStageConfig; userId?: string }) {
  const { t } = useLearningTranslation();
  const copy = normalizeCodeLocale(lesson.code_exercise_locale).value;
  const p1 = config.parts[0];
  const p2 = config.parts[1];
  const copy1 = copy.parts?.[0] ?? {};
  const copy2 = copy.parts?.[1] ?? {};

  const key = mode === "learner" && userId ? `${codeDraftKey(userId, courseId, lesson.id, config.revision)}${draftEpoch ? `:${draftEpoch}` : ""}` : null;
  useEffect(() => {
    if (!key || !userId || !draftEpoch) return;
    const previous = `${codeDraftKey(userId, courseId, lesson.id, config.revision)}${draftEpoch > 1 ? `:${draftEpoch - 1}` : ""}`;
    try { localStorage.removeItem(previous); } catch { /* Ignore */ }
  }, [key, userId, courseId, lesson.id, config.revision, draftEpoch]);

  const [restored] = useState(() => key ? readCodeDraft(key) : null);
  const initialAnswers1 = restored?.mode === "two_stage" ? restored.stage1_answers : {};
  const initialSource2 = restored?.mode === "two_stage" ? restored.stage2_source : p2.file.starter_source;
  const initialStage1Passed = restored?.mode === "two_stage" ? evaluateCodeExercise(p1, { answers: restored.stage1_answers }).passed : false;
  const initialStage = initialStage1Passed && restored?.mode === "two_stage" && restored.active_stage === 2 ? 2 : 1;

  const [answers1, setAnswers1] = useState<Record<string, string>>(initialAnswers1);
  const [source2, setSource2] = useState<string>(initialSource2);
  const [stage1Passed, setStage1Passed] = useState<boolean>(initialStage1Passed);
  const [stage2Passed, setStage2Passed] = useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<1 | 2>(initialStage);
  const [result1, setResult1] = useState<CodeExerciseResult | null>(null);
  const [result2, setResult2] = useState<CodeExerciseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [completionPending, setCompletionPending] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [solution, setSolution] = useState(false);
  const [hints, setHints] = useState(false);
  const [tab2, setTab2] = useState("code");

  const segments1 = useMemo(() => parseMarkers(p1.file.starter_source), [p1]);
  const lines1 = useMemo(() => {
    const out = segments1.reduce<FillSegment[][]>((acc, s) => {
      if (s.type === "blank") { acc[acc.length - 1].push(s); return acc; }
      s.value.split("\n").forEach((part, i) => { if (i) acc.push([]); if (part) acc[acc.length - 1].push({ type: "source", value: part }); });
      return acc;
    }, [[]]);
    if (out.length > 1 && !out[out.length - 1].length) out.pop();
    return out;
  }, [segments1]);

  const save = useCallback(() => {
    if (!key) return;
    setSaved(saveCodeDraft(key, {
      mode: "two_stage",
      stage1_answers: answers1,
      stage2_source: source2,
      active_stage: activeStage,
      stage1_passed: stage1Passed,
      updated_at: new Date().toISOString(),
    }));
  }, [key, answers1, source2, activeStage, stage1Passed]);

  useEffect(() => {
    if (!key) return;
    const persist = () => saveCodeDraft(key, {
      mode: "two_stage",
      stage1_answers: answers1,
      stage2_source: source2,
      active_stage: activeStage,
      stage1_passed: stage1Passed,
      updated_at: new Date().toISOString(),
    });
    const timer = setTimeout(() => setSaved(persist()), 350);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [key, answers1, source2, activeStage, stage1Passed]);

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
      if (activeStage === 1) {
        const evaluated = evaluateCodeExercise(p1, { answers: answers1 });
        setResult1(evaluated);
        if (key) void recordLearningEvent(courseId, lesson.id, "code_exercise_checked", evaluated.passed);
        if (evaluated.passed) {
          setStage1Passed(true);
        }
      } else {
        const evaluated = evaluateCodeExercise(p2, { source: source2 });
        setResult2(evaluated);
        if (key) void recordLearningEvent(courseId, lesson.id, "code_exercise_checked", evaluated.passed);
        if (evaluated.passed) {
          setStage2Passed(true);
          const p1CurrentlyPassed = evaluateCodeExercise(p1, { answers: answers1 }).passed;
          if (p1CurrentlyPassed && mode === "learner" && !completed) {
            setCompletionPending(true);
            await onComplete();
            setCompletionPending(false);
          }
        }
      }
    } catch {
      setError(t("learning.systemError"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [activeStage, p1, p2, answers1, source2, key, courseId, lesson.id, mode, completed, completionPending, onComplete, t]);

  useEffect(() => {
    onAction({
      label: t(busy ? "learning.checking" : completionPending ? "learning.retryProgress" : "learning.checkCode"),
      disabled: busy,
      pending: busy,
      run: check,
    });
    return () => onAction(null);
  }, [onAction, check, busy, completionPending, t]);

  const { confirm, confirmation } = useLearningConfirm();
  async function reset() {
    if (activeStage === 1) {
      if (Object.values(answers1).some(Boolean) && !await confirm(t("learning.resetConfirm"))) return;
      setAnswers1({}); setResult1(null); setError(null); setStage1Passed(false); setCompletionPending(false);
    } else {
      if (source2 !== p2.file.starter_source && !await confirm(t("learning.resetConfirm"))) return;
      setSource2(p2.file.starter_source); setResult2(null); setError(null); setStage2Passed(false); setCompletionPending(false);
    }
  }

  const activeHints = (activeStage === 1 ? (copy1.hints ?? p1.hints) : (copy2.hints ?? p2.hints)) ?? [];
  const activeSolution = activeStage === 1 ? p1.reference_solution : p2.reference_solution;
  const activeInstructions = activeStage === 1 ? (copy1.instructions ?? p1.instructions) : (copy2.instructions ?? p2.instructions);

  return (
    <div className="space-y-4" onKeyDown={e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void check(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
    }}>
      {/* Notice & Stage Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="cta"
            hierarchy={activeStage === 1 ? "primary" : "secondary"}
            onClick={() => { setActiveStage(1); setError(null); }}
          >
            {stage1Passed ? "✓ " : ""}{t("learning.codePart1")}
          </Button>
          <Button
            type="button"
            variant="cta"
            hierarchy={activeStage === 2 ? "primary" : "secondary"}
            disabled={!stage1Passed}
            title={!stage1Passed ? t("learning.codePart2Locked") : undefined}
            onClick={() => { if (stage1Passed) { setActiveStage(2); setError(null); } }}
          >
            {stage2Passed ? "✓ " : !stage1Passed ? "🔒 " : ""}{t("learning.codePart2")}
          </Button>
        </div>
        <p className="text-xs text-foreground-muted">{t("learning.textRulesNotice")}</p>
      </div>

      {activeInstructions && (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 text-sm leading-6">
          <p className="whitespace-pre-wrap">{activeInstructions}</p>
        </div>
      )}

      {/* Stage 1: Fill in Blanks */}
      {activeStage === 1 && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <p className="border-b border-border-subtle px-4 py-2 font-mono text-xs text-foreground-muted">{p1.file.path}</p>
            <pre className="overflow-x-auto py-3 font-mono text-sm leading-9 max-sm:leading-[2.75rem]">{lines1.map((line, n) => <div key={n} className="flex min-h-9 max-sm:min-h-11">
              <span aria-hidden="true" className="w-10 shrink-0 select-none pr-3 text-right text-foreground-subtle">{n + 1}</span>
              <code className="whitespace-pre pr-4">{line.map((s, i) => {
                if (s.type === "source") return <span key={i}>{s.value}</span>;
                const value = answers1[s.id] ?? "";
                const passed = result1?.results.find(r => r.test_id === s.id)?.passed;
                return <input key={s.id} disabled={busy} aria-label={s.id} aria-invalid={passed === false} value={value} placeholder="…" spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" style={{ width: `calc(${Math.max(6, value.length + 1)}ch + 1rem)` }} onChange={e => { setAnswers1(a => ({ ...a, [s.id]: e.target.value.slice(0, 1024) })); setResult1(null); setError(null); setStage1Passed(false); setCompletionPending(false); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); void check(); } }} className={cn("mx-0.5 h-8 max-w-full rounded-md border border-dashed px-2 align-middle font-mono text-sm text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus:border-solid focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 max-sm:h-10", passed === undefined ? "border-primary/40 bg-surface-base" : passed ? "border-solid border-success bg-success/10" : "border-solid border-destructive bg-destructive/10")} />;
              })}</code>
            </div>)}</pre>
          </div>

          <div aria-live="polite" className="space-y-2">
            {result1 && (
              <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-raised p-4">
                <h3 className="font-medium">{t("learning.tests")}</h3>
                <p className={cn("font-medium", result1.passed ? "text-success" : "text-destructive")}>
                  {t(result1.passed ? "learning.passed" : "learning.failed")}
                </p>
                {!result1.passed && (
                  <div className="space-y-2">
                    {result1.results.map(r => {
                      const feedback = copy1.blank_feedback?.[r.test_id] ?? p1.blanks.find(b => b.id === r.test_id)?.feedback;
                      return (
                        <div key={r.test_id} className={cn("space-y-1 rounded-lg border p-3 text-sm", r.passed ? "border-success/25 bg-success/10" : "border-destructive/30 bg-destructive/10")}>
                          <p className="font-medium">
                            <span aria-hidden="true" className={r.passed ? "text-success" : "text-destructive"}>{r.passed ? "✓" : "✕"}</span> {r.test_id}
                          </p>
                          {!r.passed && feedback && <p className="text-foreground-muted">{feedback}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          {stage1Passed && (
            <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4">
              <span className="text-sm font-medium text-success">{t("learning.passed")} — {t("learning.codePart1")}</span>
              <Button type="button" variant="cta" hierarchy="primary" onClick={() => { setActiveStage(2); setError(null); }}>
                {t("learning.codeContinueToPart2")} →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Stage 2: Edit Code */}
      {activeStage === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-foreground-muted lg:hidden">{t("learning.desktopRecommended")}</p>
          <div className="flex gap-2 lg:hidden" role="group">
            {["code", "tests"].map(value => <Button type="button" key={value} variant="cta" hierarchy={tab2 === value ? "primary" : "secondary"} onClick={() => setTab2(value)}>{t(`learning.${value}`)}</Button>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]">
            <div className={tab2 !== "code" ? "hidden lg:block" : "min-w-0"}>
              <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                <p className="border-b border-border-subtle px-4 py-2 font-mono text-xs text-foreground-muted">{p2.file.path}</p>
                <CodeEditor language={config.language} source={source2} readOnly={busy} onChange={value => { if (sourceBytes(value) <= MAX_SOURCE_BYTES) { setSource2(value); setResult2(null); setError(null); setStage2Passed(false); setCompletionPending(false); } else setError(t("learning.sourceLimit")); }} />
              </div>
            </div>
            <div aria-live="polite" className={cn(tab2 !== "tests" ? "hidden lg:block" : "space-y-2", "lg:sticky lg:top-4 lg:self-start lg:max-h-[70vh] lg:overflow-y-auto")}>
              <h3 className="font-medium">{t("learning.tests")}</h3>
              {result2 ? <><p className={cn("font-medium", result2.passed ? "text-success" : "text-destructive")}>{t(result2.passed ? "learning.passed" : "learning.failed")}</p>{[...result2.results].sort((a,b) => Number(b.required)-Number(a.required)).map(r => <div key={r.test_id} className={cn("space-y-1 rounded-lg border p-3 text-sm", r.passed ? "border-success/25 bg-success/10" : "border-destructive/30 bg-destructive/10")}><p className="font-medium"><span aria-hidden="true" className={r.passed ? "text-success" : "text-destructive"}>{r.passed ? "✓" : "✕"}</span> {copy2.test_copy?.[r.test_id]?.description ?? r.description}</p>{!r.passed && <p className="text-foreground-muted">{copy2.test_copy?.[r.test_id]?.failure_message ?? r.message}</p>}{!r.passed && r.hint && <p className="text-foreground-muted">{copy2.test_copy?.[r.test_id]?.hint ?? r.hint}</p>}</div>)}</> : <p className="text-foreground-muted">{t("learning.checkPrompt")}</p>}
            </div>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {confirmation}
        <Button type="button" variant="cta" hierarchy="secondary" disabled={busy} onClick={reset}>{t("learning.reset")}</Button>
        <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setHints(v => !v)}>{t("learning.hints")}</Button>
        <Button type="button" variant="cta" hierarchy="tertiary" onClick={() => setSolution(v => !v)}>{t("learning.solution")}</Button>
        {key && saved !== null && <span role="status" className="text-xs text-foreground-muted">{t(saved ? "learning.draftSaved" : "learning.draftUnavailable")}</span>}
      </div>
      {hints && <ul className="list-disc space-y-1 rounded-xl border border-border-subtle bg-surface-raised py-3 pl-8 pr-4 text-sm">{activeHints.map((hint, i) => <li key={i}>{hint}</li>)}</ul>}
      {solution && <pre className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised p-4 font-mono text-sm leading-6">{activeSolution}</pre>}
    </div>
  );
}

function Exercise({ lesson, courseId, config, userId, mode, completed, onComplete, onAction, draftEpoch = 0 }: LessonRendererProps & { config: CodeExerciseConfig; userId?: string }) {
  const { t } = useLearningTranslation();
  const copy = normalizeCodeLocale(lesson.code_exercise_locale).value;
  const single = config.mode === "two_stage" ? config.parts[0] : config;
  const key = mode === "learner" && userId ? `${codeDraftKey(userId, courseId, lesson.id, config.revision)}${draftEpoch ? `:${draftEpoch}` : ""}` : null;
  useEffect(() => {
    if (!key || !userId || !draftEpoch) return;
    const previous = `${codeDraftKey(userId, courseId, lesson.id, config.revision)}${draftEpoch > 1 ? `:${draftEpoch - 1}` : ""}`;
    try { localStorage.removeItem(previous); } catch { /* A blocked store cannot prevent a fresh draft. */ }
  }, [key, userId, courseId, lesson.id, config.revision, draftEpoch]);
  const [restored] = useState(() => key ? readCodeDraft(key) : null);
  const [source, setSource] = useState(restored?.mode === "edit" ? restored.source : single.file.starter_source);
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
  const segments = useMemo(() => single.mode === "fill" ? parseMarkers(single.file.starter_source) : [], [single]);
  const lines = useMemo(() => { const out = segments.reduce<FillSegment[][]>((acc, s) => {
    if (s.type === "blank") { acc[acc.length - 1].push(s); return acc; }
    s.value.split("\n").forEach((part, i) => { if (i) acc.push([]); if (part) acc[acc.length - 1].push({ type: "source", value: part }); });
    return acc;
  }, [[]]); if (out.length > 1 && !out[out.length - 1].length) out.pop(); return out; }, [segments]);
  const save = useCallback(() => {
    if (!key) return;
    setSaved(saveCodeDraft(key, single.mode === "fill" ? { mode: "fill", answers, updated_at: new Date().toISOString() } : { mode: "edit", source, updated_at: new Date().toISOString() }));
  }, [key, single.mode, answers, source]);
  useEffect(() => {
    if (!key) return;
    const persist = () => saveCodeDraft(key, single.mode === "fill" ? { mode: "fill", answers, updated_at: new Date().toISOString() } : { mode: "edit", source, updated_at: new Date().toISOString() });
    const timer = setTimeout(() => setSaved(persist()), 350);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
      persist();
    };
  }, [key, single.mode, answers, source]);
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
    if ((source !== single.file.starter_source || Object.values(answers).some(Boolean)) && !await confirm(t("learning.resetConfirm"))) return;
    setSource(single.file.starter_source); setAnswers({}); setResult(null); setError(null); setCompletionPending(false);
  }
  return <div className="space-y-4" onKeyDown={e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); void check(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); }
  }}>
    {single.mode === "edit" && <><p className="text-sm text-foreground-muted lg:hidden">{t("learning.desktopRecommended")}</p><div className="flex gap-2 lg:hidden" role="group">{["code", "tests"].map(value => <Button type="button" key={value} variant="cta" hierarchy={(tab === value ? "primary" : "secondary")} onClick={() => setTab(value)}>{t(`learning.${value}`)}</Button>)}</div></>}
    <div className={single.mode === "edit" ? "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)]" : "space-y-4"}>
      <div className={single.mode === "edit" && tab !== "code" ? "hidden lg:block" : "min-w-0"}>
        {single.mode === "fill" ? <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
          <p className="border-b border-border-subtle px-4 py-2 font-mono text-xs text-foreground-muted">{single.file.path}</p>
          <pre className="overflow-x-auto py-3 font-mono text-sm leading-9 max-sm:leading-[2.75rem]">{lines.map((line, n) => <div key={n} className="flex min-h-9 max-sm:min-h-11">
            <span aria-hidden="true" className="w-10 shrink-0 select-none pr-3 text-right text-foreground-subtle">{n + 1}</span>
            <code className="whitespace-pre pr-4">{line.map((s, i) => {
              if (s.type === "source") return <span key={i}>{s.value}</span>;
              const value = answers[s.id] ?? "";
              const passed = result?.results.find(r => r.test_id === s.id)?.passed;
              return <input key={s.id} disabled={busy} aria-label={s.id} aria-invalid={passed === false} value={value} placeholder="…" spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" style={{ width: `calc(${Math.max(6, value.length + 1)}ch + 1rem)` }} onChange={e => { setAnswers(a => ({ ...a, [s.id]: e.target.value.slice(0, 1024) })); setResult(null); setError(null); setCompletionPending(false); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); void check(); } }} className={cn("mx-0.5 h-8 max-w-full rounded-md border border-dashed px-2 align-middle font-mono text-sm text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus:border-solid focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 max-sm:h-10", passed === undefined ? "border-primary/40 bg-surface-base" : passed ? "border-solid border-success bg-success/10" : "border-solid border-destructive bg-destructive/10")} />;
            })}</code>
          </div>)}</pre>
        </div> : <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised"><p className="border-b border-border-subtle px-4 py-2 font-mono text-xs text-foreground-muted">{single.file.path}</p><CodeEditor language={config.language} source={source} readOnly={busy} onChange={value => { if (sourceBytes(value) <= MAX_SOURCE_BYTES) { setSource(value); setResult(null); setError(null); setCompletionPending(false); } else setError(t("learning.sourceLimit")); }} /></div>}
      </div>
      <div aria-live="polite" className={cn(single.mode === "edit" && tab !== "tests" ? "hidden lg:block" : "space-y-2", single.mode === "edit" && "lg:sticky lg:top-4 lg:self-start lg:max-h-[70vh] lg:overflow-y-auto")}>
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
    {hints && <ul className="list-disc space-y-1 rounded-xl border border-border-subtle bg-surface-raised py-3 pl-8 pr-4 text-sm">{(copy.hints ?? single.hints ?? []).map((hint,i) => <li key={i}>{hint}</li>)}</ul>}
    {solution && <pre className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised p-4 font-mono text-sm leading-6">{single.reference_solution}</pre>}
  </div>;
}
