import { lessonText } from "@/features/learning/lessonCopy";
import { validateLessonResources } from "@/features/learning/resourceValidation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { CourseResourceIcon } from "@/components/courses/CourseResourceIcon";
import { resourceIconForUrl } from "@/features/learning/resourceGroups";
import { ArrowUpRight, CheckCircle, CircleNotch, Question } from "@phosphor-icons/react";
import { useAuth } from "@/stores/authStore";
import { LessonRenderer } from "@/features/learning/LessonRenderer";
import { LessonDataError } from "@/features/learning/LessonDataError";
import { LessonColumn } from "@/features/learning/lessonLayout";
import { canAskAboutLesson } from "@/features/learning/askAi";
import { AskAiMenu } from "./AskAiMenu";
import type { LessonActionState } from "@/features/learning/types";
import type { CourseLesson } from "@/types/courses";
import type { SectionQuestion } from "@/types/questions";
import { getLessonFormat } from "@/lib/lessonFormat";
import { useLearningConfirm } from "@/features/learning/useLearningConfirm";
import { useQueryClient } from "@tanstack/react-query";
import { xpAwardNotificationQueryKey } from "@/features/xp/xpNotificationKeys";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { TooltipPreview } from "@/components/ui/tooltip";

type Props = {
  lesson: CourseLesson | null; lessonIndex: number | null; isDraftLesson: boolean; completed: boolean;
  hasFullCourseAccess: boolean; previousLesson: CourseLesson | null; nextLesson: CourseLesson | null;
  translate: (key: string, options?: Record<string, unknown>) => string;
  onMarkComplete(): Promise<void>; onReset?(clear: boolean): Promise<void>; onNavigateToLesson(id: string): void;
  courseId?: string | null; mode?: "learner" | "preview"; questions?: SectionQuestion[];
  contentLocale?: string; courseTitle?: string | null;
  hasFinalAssignment?: boolean;
  resetEpoch?: number; draftEpoch?: number;
  actionSlot?: HTMLElement | null;
  askAiSlot?: HTMLElement | null;
  /** Where the quiz score goes; falls back to `askAiSlot` when the footer has no separate score slot. */
  summarySlot?: HTMLElement | null;
};
export function LessonPlayerCard(props: Props) {
  const { user } = useAuth();
  return <Workspace key={`${props.courseId}:${props.lesson?.id}:${props.mode}:${user?.id}:${props.contentLocale}`} {...props} />;
}
function Workspace({ lesson, lessonIndex, isDraftLesson, hasFullCourseAccess, completed, previousLesson, nextLesson, onMarkComplete, onReset, onNavigateToLesson, courseId, mode = "learner", questions, contentLocale, courseTitle, hasFinalAssignment = false, resetEpoch = 0, draftEpoch = 0, actionSlot, askAiSlot, summarySlot }: Props) {
  const { t } = useTranslation("courses");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, confirmation } = useLearningConfirm();
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [action, setAction] = useState<LessonActionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registerAction = useCallback((next: LessonActionState | null) => setAction(next), []);
  const reset = async (clear: boolean) => {
    if (!onReset || inFlight.current || busy || action?.pending) return;
    if (clear && !await confirm(t("learning.redoConfirm"))) return;
    if (!active.current || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null);
    try { await onReset(clear); }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : t("learning.systemError")); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const complete = useCallback(async () => {
    if (mode === "preview") return;
    await onMarkComplete();
    void queryClient.invalidateQueries({ queryKey: ["xp"] });
    void queryClient.invalidateQueries({ queryKey: xpAwardNotificationQueryKey });
    if (!active.current) return;
    toast.success(t("learning.completedToast"), { position: "top-right" });
    // The floating bar is a complete/incomplete toggle, so it stays on the lesson.
    if (actionSlot === undefined && nextLesson && lesson && ["article","video","practice"].includes(getLessonFormat(lesson))) onNavigateToLesson(nextLesson.id);
  }, [mode, onMarkComplete, lesson, queryClient, nextLesson, onNavigateToLesson, t, actionSlot]);
  if (!lesson || !courseId) return <LessonDataError />;
  const resources = validateLessonResources(lesson.resources ?? [], lesson.id, "vi", true).length ? [] : lesson.resources ?? [];
  const format = getLessonFormat(lesson);
  const isExercise = format === "quiz" || format === "code_exercise";
  // An exercise shows Hint until it has a result, then swaps to Ask AI; other lessons always show Ask AI.
  // A quiz is an assessment: Ask AI never carries its questions or answers.
  const hasResult = format === "quiz" ? action?.summary?.passed !== undefined : action?.checked === true;
  const askAiInFooter = isExercise ? hasResult && (format === "quiz" || canAskAboutLesson(lesson)) : canAskAboutLesson(lesson);
  // Hint is the project's TooltipPreview (same delay, animation and touch behaviour as the component showcase):
  // a label that shows the instructor's hints, not an action button.
  const hintButton = action?.hint && (
    <TooltipPreview
      arrow="bottom-left"
      trigger={<>{t("learning.hints")}<Question className="size-4" weight="duotone" aria-hidden /></>}
      triggerLabel={t("learning.hints")}
      triggerClassName="size-auto cursor-default gap-md rounded-[4px] px-xs py-[6px] font-display text-cta-medium"
      supportingText={action.hint.items.length
        ? <ul className="list-disc space-y-1 pl-4">{action.hint.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
        : t("learning.noHints")}
    >
      {t("learning.hints")}
    </TooltipPreview>
  );
  const run = async () => {
    if (inFlight.current) return;
    if (mode === "learner" && !user) { navigate("/login", { state: { from: { pathname: `/study/${courseId}/lesson/${lesson.id}` } } }); return; }
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      if (completed && mode === "learner") {
        if (nextLesson) onNavigateToLesson(nextLesson.id);
        else navigate(hasFinalAssignment ? `/study/${courseId}/final-assignment` : `/courses/${courseId}`);
      } else await action?.run();
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : t("learning.systemError")); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const label = busy ? t("learning.saving") : mode === "learner" && !user ? t("learning.login") : completed && mode === "learner" ? t(nextLesson ? "learning.next" : hasFinalAssignment ? "learning.finalAssignmentLink" : "learning.finish") : action?.label ?? t("learning.unavailable");
  // TODO(figma-learn): chỉ dùng cho nút "Làm lại từ đầu" đang tạm ẩn
  // const format = getLessonFormat(lesson);
  const inFooter = actionSlot !== undefined && mode === "learner";
  const canReset = mode === "learner" && !!user && !!onReset && hasFullCourseAccess && !isDraftLesson;
  const primaryDisabled = busy || action?.pending || (!(completed && mode === "learner") && (!action || (action.disabled && (mode === "preview" || !!user))));
  // Only "mark complete" and "mark incomplete" have a short form; other labels come from the lesson itself.
  const toggleLabel: { full: string; short?: string } = busy
    ? { full: t("learning.saving") }
    : completed
      ? canReset
        ? { full: t("learning.markIncomplete"), short: t("learning.markIncompleteShort") }
        : { full: t("learning.completed") }
      : action?.label === t("learning.completeContinue")
        ? { full: t("learning.markComplete"), short: t("learning.markCompleteShort") }
        : { full: label };
  const header = <>{mode === "preview" && <p className="rounded-lg bg-primary/10 p-3 text-sm">{t("learning.previewBanner")}</p>}<div><h1 className="text-heading-large font-display text-action-text">{lessonText(lesson.title)}</h1>{lesson.short_description && <p className="mt-3xl text-body-medium text-action-text">{lessonText(lesson.short_description)}</p>}{!inFooter && canAskAboutLesson(lesson) && <div className="mt-3"><AskAiMenu lesson={lesson} courseTitle={courseTitle} /></div>}</div></>;
  const resourcesNode = !!resources.length && (
    <section>
      <h2 className="mb-3xl font-display text-heading-large text-action-text">{t("learning.resources")}</h2>
      <ul className="flex flex-wrap gap-md">
        {resources.map((r, i) => (
          <li key={`${r.url}:${i}`} className="min-w-0 max-w-full rounded-xl bg-resource-item-surface">
            <Action size="large" nativeButton={false} render={<a href={r.url} target="_blank" rel="noopener noreferrer" />}
              icon={<CourseResourceIcon icon={resourceIconForUrl(r.url)} />} label={r.title}
              trailingGroup={<ArrowUpRight className="size-4" weight="duotone" aria-hidden />} />
          </li>
        ))}
      </ul>
    </section>
  );
  return <div className="flex min-h-full flex-col">
    <div className="flex-1">
      <LessonRenderer lesson={lesson} courseId={courseId} mode={mode} contentLocale={contentLocale} completed={completed} onComplete={complete} onAction={registerAction} questions={questions} resetEpoch={resetEpoch} draftEpoch={draftEpoch} contentFrame={{ header, resources: resourcesNode || undefined }} />
    </div>
    {inFooter && (
      <LessonColumn className="space-y-3 pb-6">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {confirmation}
        <div className="flex flex-wrap items-center gap-md">
          {/* TODO(figma-learn): tạm ẩn "Bài trước" (Figma footer chưa có), chờ thiết kế mới nhất
          <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={!previousLesson || busy} onClick={() => previousLesson && onNavigateToLesson(previousLesson.id)}>{t("learning.previous")}</Button>
          */}
          {/* TODO(figma-learn): tạm ẩn "Làm lại từ đầu" theo yêu cầu, bật lại khi có thiết kế
          {canReset && ["quiz", "practice", "code_exercise"].includes(format) && <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={busy || action?.pending} onClick={() => void reset(true)}>{t("learning.redoFromStart")}</Button>}
          */}
        </div>
      </LessonColumn>
    )}
    {!inFooter && (
    <footer className="sticky bottom-0 z-10 border-t border-border bg-surface-base px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-3">
      {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
      {confirmation}
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:gap-3">
        <Button type="button" variant="cta" hierarchy="secondary" className="min-h-11 min-w-0 w-full whitespace-normal px-2 text-center leading-tight sm:w-auto sm:shrink-0 sm:px-6" disabled={!previousLesson || busy} onClick={() => previousLesson && onNavigateToLesson(previousLesson.id)}>{t("learning.previous")}</Button>
        <span className="hidden min-w-0 flex-1 text-center text-sm text-foreground-muted sm:block">{t("learning.lessonNumber", { number: (lessonIndex ?? 0)+1 })}</span>
        {hintButton && <div className="col-span-2 sm:col-span-1">{hintButton}</div>}
        {mode === "learner" && user && onReset && hasFullCourseAccess && !isDraftLesson && (completed || ["quiz", "practice", "code_exercise"].includes(getLessonFormat(lesson))) && (
          <div className="order-first col-span-2 flex flex-wrap justify-end gap-2 sm:order-none sm:shrink-0 sm:flex-nowrap">
            {completed && <Button type="button" variant="cta" hierarchy="secondary" className="min-h-11 min-w-0 whitespace-normal text-center leading-tight sm:whitespace-nowrap" disabled={busy || action?.pending} onClick={() => void reset(false)}>{t("learning.markIncomplete")}</Button>}
            {["quiz", "practice", "code_exercise"].includes(getLessonFormat(lesson)) && <Button type="button" variant="cta" hierarchy="secondary" className="min-h-11 min-w-0 whitespace-normal text-center leading-tight sm:whitespace-nowrap" disabled={busy || action?.pending} onClick={() => void reset(true)}>{t("learning.redoFromStart")}</Button>}
          </div>
        )}
        <Button type="button" className="min-h-11 min-w-0 w-full whitespace-normal px-2 text-center leading-tight sm:w-auto sm:shrink-0 sm:px-6" disabled={primaryDisabled} onClick={() => void run()}>{label}</Button>
      </div>
    </footer>
    )}
    {inFooter && actionSlot && createPortal(
      // One toggle: complete via the lesson's own action, uncomplete via reset.
      <Button type="button" variant="cta" hierarchy={completed ? "secondary" : "primary"} size="small" aria-pressed={completed}
        aria-label={toggleLabel.short ? toggleLabel.full : undefined}
        disabled={completed ? !canReset || busy || action?.pending : primaryDisabled}
        onClick={() => void (completed ? reset(false) : run())}
        leadingIcon={busy ? <CircleNotch className="animate-spin" aria-hidden /> : <CheckCircle weight={completed ? "fill" : "regular"} className={completed ? "text-success" : undefined} aria-hidden />}>
        {toggleLabel.short
          ? <><span className="max-sm:hidden">{toggleLabel.full}</span><span className="sm:hidden">{toggleLabel.short}</span></>
          : toggleLabel.full}
      </Button>,
      actionSlot,
    )}
    {inFooter && askAiSlot && hintButton && createPortal(hintButton, askAiSlot)}
    {inFooter && askAiSlot && askAiInFooter && createPortal(<AskAiMenu lesson={lesson} courseTitle={courseTitle} compact />, askAiSlot)}
    {inFooter && (summarySlot ?? askAiSlot) && action?.summary && createPortal(
      <div role="status" className="flex items-baseline gap-lg px-3">
        {action.summary.passed === undefined ? (
          <p className="flex items-baseline gap-xs whitespace-nowrap">
            <span className="text-label-small leading-[1.4] text-foreground-subtle max-sm:hidden">{t("learning.quizAchieveLead")}</span>
            <span className="font-display text-cta-medium text-foreground">{action.summary.correct}</span>
            <span className="text-label-small leading-[1.4] text-foreground-subtle">/{action.summary.total}<span className="max-sm:hidden">{` ${t("learning.quizAchieveTail")}`}</span></span>
          </p>
        ) : (
          <>
            <p className="flex items-baseline gap-xs whitespace-nowrap">
              <span className="font-display text-cta-medium text-foreground">{action.summary.correct}</span>
              <span className="font-display text-cta-small text-foreground-subtle">/</span>
              <span className="text-label-small leading-[1.4] text-foreground-subtle">{action.summary.total}<span className="max-sm:hidden">{` ${t("learning.quizScoreCorrect")}`}</span></span>
            </p>
            <Badge size="xsmall" color={action.summary.passed ? "success" : "error"}>{t(action.summary.passed ? "learning.passed" : "learning.failed")}</Badge>
          </>
        )}
      </div>,
      (summarySlot ?? askAiSlot)!,
    )}
  </div>;
}
