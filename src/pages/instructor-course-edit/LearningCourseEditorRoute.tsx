import type { PublishValidationIssue } from "@/features/learning/types";
import { useUnsavedLearning } from "@/features/learning/admin/useUnsavedLearning";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import InstructorCourseEdit from "./InstructorCourseEdit";
import { useAuth } from "@/stores/authStore";
import { getLearningEditor, getLearningReadiness, publishLearningReport } from "@/lib/learning";
import { defaultCodeConfig } from "@/features/code-exercise/config";
import { LessonEditor } from "@/features/learning/admin/LessonEditor";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { LessonReadinessBadge } from "@/features/learning/admin/LessonReadinessBadge";
import type { CourseLesson } from "@/types/courses";
import { refreshCourseTotalDuration } from "@/lib/courses";
import { validateLesson } from "@/features/learning/validation";

/** Extend the existing instructor editor without replacing its operational panels. */
export default function LearningCourseEditorRoute() {
  const { id } = useParams();
  const { user } = useAuth();
  return <LearningCourseEditorWorkspace key={`${id}:${user?.id}`} />;
}

function LearningCourseEditorWorkspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLearningTranslation();
  const client = useQueryClient();
  const bundle = useQuery({ queryKey: ["courses", "learning-editor", id, user?.id], queryFn: () => getLearningEditor(id!), enabled: !!id && !!user });
  const readiness = useQuery({ queryKey: ["courses", "learning-readiness", id, user?.id], queryFn: ({ signal }) => getLearningReadiness(id!, signal), enabled: !!id && !!user });
  const publication = useQuery({ queryKey: ["courses", "learning-publication", id, user?.id], queryFn: () => publishLearningReport(id!), enabled: !!id && !!user });
  const readinessByLesson = new Map(readiness.data?.map(row => [row.lessonId, row.issues]));
  const [editing, setEditing] = useState<{ lesson: CourseLesson; isNew: boolean; issueCodes?: string[]; issues?: PublishValidationIssue[] } | null>(null);
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
        if (!combined.some(item => item.lessonId === issue.lessonId && item.locale === issue.locale && item.code === issue.code)) combined.push(issue);
      }
    }
    return combined;
  }, [bundle.data?.lessons, publication.data, readiness.data]);
  const refresh = async () => {
    if (id) await refreshCourseTotalDuration(id);
    await Promise.all([client.invalidateQueries({ queryKey: ["instructor"] }), client.invalidateQueries({ queryKey: ["courses"] })]);
  };
  return <>
    <InstructorCourseEdit onDirtyChange={setCourseDirty} onCreateLearningLesson={lesson => setEditing({ isNew: true, lesson: { ...lesson, code_exercise_config: defaultCodeConfig() } })} renderLearningReadiness={(lesson, openEditor) => lesson.archived_at ? null : <LessonReadinessBadge issues={readinessByLesson.get(lesson.id)} failed={readiness.isError} onOpen={openEditor} onRetry={() => void readiness.refetch()} />} onEditLearningLesson={lesson => setEditing({ lesson, isNew: false })} learningTools={focusCourseIssue => <>
      <Button type="button" variant="outline" size="sm" onClick={() => setCheckingContent(true)}>{t("learning.contentCheck")}</Button>
      {publication.isError && <Button type="button" variant="outline" size="sm" onClick={() => void publication.refetch()}>{t("learning.retryPublication")}</Button>}
      <Link to={`/instructor/courses/${id}/preview`} className="text-sm text-primary underline">{t("learning.preview")}</Link>
      <Dialog open={checkingContent} onOpenChange={setCheckingContent}>
        <DialogContent><DialogTitle>{t("learning.contentCheckTitle")}</DialogTitle><DialogDescription>{issues.length ? t("learning.reviewCourseOnly") : t("learning.noContentIssues")}</DialogDescription>
          {issues.length > 0 && <ul className="space-y-2">{issues.map((issue, index) => {
            const lesson = issue.lessonId ? bundle.data?.lessons.find(item => item.id === issue.lessonId) : undefined;
            return <li key={`${issue.lessonId ?? issue.panel}:${issue.code}:${index}`}><button type="button" className="text-left text-sm text-destructive underline" onClick={() => { if (!issue.lessonId) { setCheckingContent(false); focusCourseIssue(issue); return; } if (lesson) { setCheckingContent(false); setEditing({ lesson, isNew: false, issues: issues.filter(item => item.lessonId === issue.lessonId) }); } }}>{lesson ? `${lesson.title} · ` : ""}{t(`learning.validation.${issue.code}`, { defaultValue: issue.code })}</button></li>;
          })}</ul>}
        </DialogContent>
      </Dialog>
    </>} />
    {editing && id && bundle.data?.course && <LessonEditor key={editing.lesson.id} onDirtyChange={setLessonDirty} courseId={id} finalAssignment={bundle.data.course} initial={editing.lesson} isNew={editing.isNew} initialIssueCodes={editing.issueCodes} initialIssues={editing.issues} sections={bundle.data.sections}
      nextLessonOrder={Math.max(-1, ...bundle.data.lessons.map(lesson => lesson.order)) + 1}
      primaryLocale={bundle.data.course.i18n?.primary_content_locale ?? "vi"}
      locales={{ vi: bundle.data.locales.vi.get(editing.lesson.id), en: bundle.data.locales.en.get(editing.lesson.id) }}
      onClose={() => setEditing(null)} onSaved={refresh} />}
    <Dialog open={navigationBlocker.state==="blocked"} onOpenChange={open=>{if(!open&&navigationBlocker.state==="blocked")navigationBlocker.reset();}}>
      <DialogContent><DialogTitle>{t("learning.unsavedTitle")}</DialogTitle><DialogDescription>{t("learning.dirtyConfirm")}</DialogDescription>
        <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={()=>{if(navigationBlocker.state==="blocked")navigationBlocker.reset();}}>{t("learning.keepEditing")}</Button><Button type="button" onClick={()=>{if(navigationBlocker.state==="blocked")navigationBlocker.proceed();}}>{t("learning.discardAndLeave")}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
