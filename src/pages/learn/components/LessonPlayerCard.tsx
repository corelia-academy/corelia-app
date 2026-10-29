import { lessonText } from "@/features/learning/lessonCopy";
import { validateLessonResources } from "@/features/learning/resourceValidation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { LessonRenderer } from "@/features/learning/LessonRenderer";
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
};
export function LessonPlayerCard(props: Props) {
  const { user } = useAuth();
  return <Workspace key={`${props.courseId}:${props.lesson?.id}:${props.mode}:${user?.id}:${props.contentLocale}`} {...props} />;
}
function Workspace({ lesson, lessonIndex, isDraftLesson, hasFullCourseAccess, completed, previousLesson, nextLesson, onMarkComplete, onReset, onNavigateToLesson, courseId, mode = "learner", questions, contentLocale, courseTitle, hasFinalAssignment = false, resetEpoch = 0, draftEpoch = 0, actionSlot, askAiSlot }: Props) {
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
    if (nextLesson && lesson && ["article","video","practice"].includes(getLessonFormat(lesson))) onNavigateToLesson(nextLesson.id);
  }, [mode, onMarkComplete, lesson, queryClient, nextLesson, onNavigateToLesson, t]);
  if (!lesson || !courseId) return <p className="p-6">{t("learning.unavailable")}</p>;
  const resources = validateLessonResources(lesson.resources ?? [], lesson.id, "vi", true).length ? [] : lesson.resources ?? [];
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
  const format = getLessonFormat(lesson);
  const frameLayout = mode === "learner" && (format === "video" || format === "article");
  const inFooter = actionSlot !== undefined && mode === "learner";
  const canReset = mode === "learner" && !!user && !!onReset && hasFullCourseAccess && !isDraftLesson;
  const primaryDisabled = busy || action?.pending || (!(completed && mode === "learner") && (!action || (action.disabled && (mode === "preview" || !!user))));
  const header = <div><p className="text-sm text-foreground-muted">{t(`learning.formats.${getLessonFormat(lesson)}`)} {completed && `· ${t("learning.completed")}`}</p><h1 className="mt-2 text-heading-large font-display">{lessonText(lesson.title)}</h1>{lesson.short_description && <p className="mt-2 text-foreground-muted">{lessonText(lesson.short_description)}</p>}{!inFooter && canAskAboutLesson(lesson) && <div className="mt-3"><AskAiMenu lesson={lesson} courseTitle={courseTitle} /></div>}</div>;
  const resourcesNode = !!resources.length && (
    frameLayout
      ? <section>
          <h2 className="mb-3xl font-display text-heading-large text-action-text">{t("learning.resources")}</h2>
          <div className="flex flex-col gap-xl text-body-large text-action-text">
            {resources.map((r,i) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="block text-primary underline">{r.title}</a>)}
          </div>
        </section>
      : <section className="rounded-xl border border-border p-4"><h2 className="mb-2 font-medium">{t("learning.resources")}</h2>{resources.map((r,i) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="block text-primary underline">{r.title}</a>)}</section>
  );
  return <div className="flex min-h-full flex-col">
    {frameLayout ? (
      <div className="flex-1">
        <LessonRenderer lesson={lesson} courseId={courseId} mode={mode} contentLocale={contentLocale} completed={completed} onComplete={complete} onAction={registerAction} questions={questions} resetEpoch={resetEpoch} draftEpoch={draftEpoch} contentFrame={{ header, resources: resourcesNode || undefined }} />
      </div>
    ) : (
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6">
        {mode === "preview" && <p className="rounded-lg bg-primary/10 p-3 text-sm">{t("learning.previewBanner")}</p>}
        {header}
        <LessonRenderer lesson={lesson} courseId={courseId} mode={mode} contentLocale={contentLocale} completed={completed} onComplete={complete} onAction={registerAction} questions={questions} resetEpoch={resetEpoch} draftEpoch={draftEpoch} />
        {resourcesNode}
      </div>
    )}
    {inFooter && (
      <div className={`w-full space-y-3 pb-6 ${frameLayout ? "mx-auto max-w-[880px] px-4 sm:px-6 md:px-8xl" : "mx-auto max-w-5xl px-4 sm:px-6"}`}>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {confirmation}
        <div className="flex flex-wrap items-center gap-md">
          {/* TODO(figma-learn): tạm ẩn "Bài trước" (Figma footer chưa có), chờ thiết kế mới nhất
          <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={!previousLesson || busy} onClick={() => previousLesson && onNavigateToLesson(previousLesson.id)}>{t("learning.previous")}</Button>
          */}
          {canReset && ["quiz", "practice", "code_exercise"].includes(format) && <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={busy || action?.pending} onClick={() => void reset(true)}>{t("learning.redoFromStart")}</Button>}
        </div>
      </div>
    )}
    {!inFooter && (
    <footer className="sticky bottom-0 z-10 border-t border-border bg-surface-base px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-3">
      {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
      {confirmation}
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:gap-3">
        <Button type="button" variant="cta" hierarchy="secondary" className="min-h-11 min-w-0 w-full whitespace-normal px-2 text-center leading-tight sm:w-auto sm:shrink-0 sm:px-6" disabled={!previousLesson || busy} onClick={() => previousLesson && onNavigateToLesson(previousLesson.id)}>{t("learning.previous")}</Button>
        <span className="hidden min-w-0 flex-1 text-center text-sm text-foreground-muted sm:block">{t("learning.lessonNumber", { number: (lessonIndex ?? 0)+1 })}</span>
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
      <>
        {canReset && completed && <Button type="button" variant="cta" hierarchy="secondary" size="small" disabled={busy || action?.pending} onClick={() => void reset(false)}>{t("learning.markIncomplete")}</Button>}
        <Button type="button" variant="cta" hierarchy="primary" size="small" disabled={primaryDisabled} onClick={() => void run()}>{label}</Button>
      </>,
      actionSlot,
    )}
    {inFooter && askAiSlot && canAskAboutLesson(lesson) && createPortal(<AskAiMenu lesson={lesson} courseTitle={courseTitle} />, askAiSlot)}
  </div>;
}
