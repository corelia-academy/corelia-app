import type { PublishValidationIssue } from "@/features/learning/types";
import { useUnsavedLearning } from "@/features/learning/admin/useUnsavedLearning";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import InstructorCourseEdit from "./InstructorCourseEdit";
import { useAuth } from "@/stores/authStore";
import { getLearningEditor, getLearningReadiness, publishLearningReport } from "@/lib/learning";
import { defaultCodeConfig } from "@/features/code-exercise/config";
import { LessonEditor } from "@/features/learning/admin/LessonEditor";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { LessonReadinessBadge } from "@/features/learning/admin/LessonReadinessBadge";
import type { CourseLesson, SupportedCourseLocale } from "@/types/courses";
import { validateLesson } from "@/features/learning/validation";

/** Extend the existing instructor editor without replacing its operational panels. */
export default function LearningCourseEditorRoute() {
  const { id } = useParams();
  const { user } = useAuth();
  return <LearningCourseEditorWorkspace key={`${id}:${user?.id}`} />;
}

function LearningCourseEditorWorkspace() {
  const editorLocation = useLocation();
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLearningTranslation();
  const client = useQueryClient();
  const bundle = useQuery({ queryKey: ["courses", "learning-editor", id, user?.id], queryFn: () => getLearningEditor(id!), enabled: !!id && !!user });
  const readiness = useQuery({ queryKey: ["courses", "learning-readiness", id, user?.id], queryFn: ({ signal }) => getLearningReadiness(id!, signal), enabled: !!id && !!user });
  const publication = useQuery({ queryKey: ["courses", "learning-publication", id, user?.id], queryFn: () => publishLearningReport(id!), enabled: !!id && !!user });
  const readinessByLesson = new Map(readiness.data?.map(row => [row.lessonId, row.issues]));
  type EditingLesson = { lesson: CourseLesson; isNew: boolean; locale?: SupportedCourseLocale; issueCodes?: string[]; issues?: PublishValidationIssue[] };
  const [editing, setEditing] = useState<EditingLesson | null>(null);
  const [editorBundle, setEditorBundle] = useState<Awaited<ReturnType<typeof getLearningEditor>> | null>(null);
  const [editorLoadError, setEditorLoadError] = useState(false);
  const editorGeneration = useRef(0);
  const closeEditor = () => { editorGeneration.current += 1; setEditing(null); setEditorBundle(null); };
  const openEditor = async (request: EditingLesson) => {
    const generation = ++editorGeneration.current;
    setEditing(request); setEditorBundle(null); setEditorLoadError(false);
    try {
      const fresh = await client.fetchQuery({ queryKey: ["courses", "learning-editor", id, user?.id], queryFn: () => getLearningEditor(id!), staleTime: 0 });
      if (generation !== editorGeneration.current) return;
      if (!fresh.course) throw new Error("COURSE_NOT_FOUND");
      const lesson = request.isNew ? request.lesson : fresh.lessons.find(item => item.id === request.lesson.id);
      if (!lesson) throw new Error("LESSON_NOT_FOUND");
      setEditorBundle(fresh);
      setEditing({ ...request, lesson });
    } catch { if (generation === editorGeneration.current) setEditorLoadError(true); }
  };
  const [checkingContent, setCheckingContent] = useState(false);
  const [courseDirty, setCourseDirty] = useState(false);
  const [lessonDirty, setLessonDirty] = useState(false);
  const navigationBlocker = useUnsavedLearning(courseDirty || lessonDirty);
  const issues = useMemo(() => {
    const combined: PublishValidationIssue[] = [...(publication.data ?? [])];
    for (const row of readiness.data ?? []) {
      const lesson = bundle.data?.lessons.find(item => item.id === row.lessonId);
      if (!lesson) continue;
      const localIssues = validateLesson(lesson);
      for (const code of row.issues) {
        const issue = localIssues.find(item => item.code === code) ?? { lessonId: row.lessonId, field: "lesson_format", panel: "content", code };
        if (!combined.some(item => item.lessonId === issue.lessonId && item.code === issue.code)) combined.push(issue);
      }
    }
    return combined;
  }, [bundle.data?.lessons, publication.data, readiness.data]);
  const refresh = async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ["instructor"] }), client.invalidateQueries({ queryKey: ["courses"] })]);
  };
  return <>
    <InstructorCourseEdit onDirtyChange={setCourseDirty} onCreateLearningLesson={lesson => void openEditor({ isNew: true, lesson: { ...lesson, code_exercise_config: defaultCodeConfig() } })} renderLearningReadiness={(lesson, openEditor) => lesson.archived_at ? null : <LessonReadinessBadge issues={readinessByLesson.get(lesson.id)} failed={readiness.isError} onOpen={openEditor} onRetry={() => void readiness.refetch()} />} onEditLearningLesson={(lesson, locale) => void openEditor({ lesson, locale, isNew: false })} learningTools={focusCourseIssue => <>
      <Button type="button" variant="outline" size="sm" onClick={() => setCheckingContent(true)}>{t("learning.contentCheck")}</Button>
      {publication.isError && <Button type="button" variant="outline" size="sm" onClick={() => void publication.refetch()}>{t("learning.retryPublication")}</Button>}
      <Link to={`/instructor/courses/${id}/preview`} state={{ editorLocation }} className="text-sm text-primary underline">{t("learning.preview")}</Link>
      <Dialog open={checkingContent} onOpenChange={setCheckingContent}>
        <DialogContent><DialogTitle>{t("learning.contentCheckTitle")}</DialogTitle><DialogDescription>{issues.length ? t("learning.reviewCourseOnly") : t("learning.noContentIssues")}</DialogDescription>
          {issues.length > 0 && <ul className="space-y-2">{issues.map((issue, index) => {
            const lesson = issue.lessonId ? bundle.data?.lessons.find(item => item.id === issue.lessonId) : undefined;
            return <li key={`${issue.lessonId ?? issue.panel}:${issue.code}:${index}`}><button type="button" className="text-left text-sm text-destructive underline" onClick={() => { if (!issue.lessonId) { setCheckingContent(false); focusCourseIssue(issue); return; } if (lesson) { setCheckingContent(false); void openEditor({ lesson, isNew: false, issues: issues.filter(item => item.lessonId === issue.lessonId) }); } }}>{lesson ? `${lesson.title} · ` : ""}{t(`learning.validation.${issue.code}`, { defaultValue: issue.code })}</button></li>;
          })}</ul>}
        </DialogContent>
      </Dialog>
    </>} />
    {editing && !editorBundle && <Dialog open onOpenChange={open => { if (!open) closeEditor(); }}>
      <DialogContent><DialogTitle>{t("learning.edit")}</DialogTitle><DialogDescription>{t(editorLoadError ? "learning.translationLoadError" : "learning.loading")}</DialogDescription>
        {editorLoadError && <Button type="button" onClick={() => void openEditor(editing)}>{t("learning.retry")}</Button>}
        <Button type="button" variant="outline" onClick={closeEditor}>{t("learning.cancel")}</Button>
      </DialogContent>
    </Dialog>}
    {editing && id && editorBundle?.course && <LessonEditor key={editing.lesson.id} onDirtyChange={setLessonDirty} courseId={id} finalAssignment={editorBundle.course} initial={editing.lesson} isNew={editing.isNew} initialIssueCodes={editing.issueCodes} initialIssues={editing.issues} sections={editorBundle.sections}
      nextLessonOrder={Math.max(-1, ...editorBundle.lessons.map(lesson => lesson.order)) + 1}
      initialLocale={editing.locale}
      primaryLocale={editorBundle.course.i18n?.primary_content_locale ?? "vi"}
      locales={Object.fromEntries((["vi", "en"] as const).flatMap(locale => {
        const copy = editorBundle.locales[locale].get(editing.lesson.id);
        return copy == null ? [] : [[locale, copy]];
      }))}
      onClose={closeEditor} onSaved={refresh} />}
    <Dialog open={navigationBlocker.state==="blocked"} onOpenChange={open=>{if(!open&&navigationBlocker.state==="blocked")navigationBlocker.reset();}}>
      <DialogContent><DialogTitle>{t("learning.unsavedTitle")}</DialogTitle><DialogDescription>{t("learning.dirtyConfirm")}</DialogDescription>
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={()=>{if(navigationBlocker.state==="blocked")navigationBlocker.reset();}}>{t("learning.keepEditing")}</Button><Button type="button" onClick={()=>{if(navigationBlocker.state==="blocked")navigationBlocker.proceed();}}>{t("learning.discardAndLeave")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
