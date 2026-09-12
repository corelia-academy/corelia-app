import { lessonText } from "@/features/learning/lessonCopy";
import { validateLessonResources } from "@/features/learning/resourceValidation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
import { LessonRenderer } from "@/features/learning/LessonRenderer";
import type { LessonActionState } from "@/features/learning/types";
import type { CourseLesson } from "@/types/courses";
import type { SectionQuestion } from "@/types/questions";
import { getLessonFormat } from "@/lib/lessonFormat";

type Props = {
  lesson: CourseLesson | null; lessonIndex: number | null; isDraftLesson: boolean; completed: boolean;
  hasFullCourseAccess: boolean; previousLesson: CourseLesson | null; nextLesson: CourseLesson | null;
  translate: (key: string, options?: Record<string, unknown>) => string;
  onMarkComplete(): Promise<void>; onNavigateToLesson(id: string): void;
  courseId?: string | null; mode?: "learner" | "preview"; questions?: SectionQuestion[];
  contentLocale?: string;
  hasFinalAssignment?: boolean;
};
export function LessonPlayerCard(props: Props) {
  const { user } = useAuth();
  return <Workspace key={`${props.courseId}:${props.lesson?.id}:${props.mode}:${user?.id}:${props.contentLocale}`} {...props} />;
}
function Workspace({ lesson, lessonIndex, completed, previousLesson, nextLesson, onMarkComplete, onNavigateToLesson, courseId, mode = "learner", questions, contentLocale, hasFinalAssignment = false }: Props) {
  const { t } = useTranslation("courses");
  const { user } = useAuth();
  const navigate = useNavigate();
  const active = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [action, setAction] = useState<LessonActionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registerAction = useCallback((next: LessonActionState | null) => setAction(next), []);
  const complete = useCallback(async () => {
    if (mode === "preview") return;
    await onMarkComplete();
    if (!active.current) return;
    if (nextLesson && lesson && ["article","video","practice"].includes(getLessonFormat(lesson))) onNavigateToLesson(nextLesson.id);
  }, [mode, onMarkComplete, nextLesson, lesson, onNavigateToLesson]);
  if (!lesson || !courseId) return <p className="p-6">{t("learning.unavailable")}</p>;
  const resources = validateLessonResources(lesson.resources ?? [], lesson.id, "vi", true).length ? [] : lesson.resources ?? [];
  const run = async () => {
    if (inFlight.current) return;
    if (mode === "learner" && !user) { navigate("/login", { state: { from: { pathname: `/learn/${courseId}/lesson/${lesson.id}` } } }); return; }
    inFlight.current = true;
    setBusy(true); setError(null);
    try {
      if (completed && mode === "learner") {
        if (nextLesson) onNavigateToLesson(nextLesson.id);
        else { const final = document.getElementById("final-assignment"); if(final) final.scrollIntoView({ behavior: "smooth" }); else navigate(`/courses/${courseId}`); }
      } else await action?.run();
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : t("learning.systemError")); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  const label = busy ? t("learning.saving") : mode === "learner" && !user ? t("learning.login") : completed && mode === "learner" ? t(nextLesson ? "learning.next" : hasFinalAssignment ? "learning.finalAssignmentLink" : "learning.finish") : action?.label ?? t("learning.unavailable");
  return <div className="flex min-h-full flex-col">
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-6 sm:px-6">
      {mode === "preview" && <p className="rounded-lg bg-primary/10 p-3 text-sm">{t("learning.previewBanner")}</p>}
      <div><p className="text-sm text-foreground-muted">{t(`learning.formats.${getLessonFormat(lesson)}`)} {completed && `· ${t("learning.completed")}`}</p><h1 className="mt-2 text-heading-large font-display">{lessonText(lesson.title)}</h1>{lesson.short_description && <p className="mt-2 text-foreground-muted">{lessonText(lesson.short_description)}</p>}</div>
      <LessonRenderer lesson={lesson} courseId={courseId} mode={mode} contentLocale={contentLocale} completed={completed} onComplete={complete} onAction={registerAction} questions={questions} />
      {!!resources.length && <section className="rounded-xl border border-border p-4"><h2 className="mb-2 font-medium">{t("learning.resources")}</h2>{resources.map((r,i) => <a key={i} href={r.url} target="_blank" rel="noreferrer" className="block text-primary underline">{r.title}</a>)}</section>}
    </div>
    <footer className="sticky bottom-0 z-10 border-t border-border bg-surface-base px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={!previousLesson || busy} onClick={() => previousLesson && onNavigateToLesson(previousLesson.id)}>{t("learning.previous")}</Button>
        <span className="hidden text-sm text-foreground-muted sm:block">{t("learning.lessonNumber", { number: (lessonIndex ?? 0)+1 })}</span>
        <Button type="button" disabled={busy || action?.pending || (!(completed && mode === "learner") && (!action || (action.disabled && (mode === "preview" || !!user))))} onClick={() => void run()}>{label}</Button>
      </div>
    </footer>
  </div>;
}
