import type { PublishValidationIssue } from "@/features/learning/types";
import { useUnsavedLearning } from "@/features/learning/admin/useUnsavedLearning";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";
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
  const [courseDirty, setCourseDirty] = useState(false);
  const [lessonDirty, setLessonDirty] = useState(false);
  const navigationBlocker = useUnsavedLearning(courseDirty || lessonDirty);
  const firstIssue = readiness.data?.find(row => row.issues.length);
  const firstIssueLesson = bundle.data?.lessons.find(lesson => lesson.id === firstIssue?.lessonId);
  const refresh = async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ["instructor"] }), client.invalidateQueries({ queryKey: ["courses"] })]);
  };
  return <>
    <InstructorCourseEdit onDirtyChange={setCourseDirty} onCreateLearningLesson={lesson => setEditing({ isNew: true, lesson: { ...lesson, code_exercise_config: defaultCodeConfig() } })} renderLearningReadiness={lesson => lesson.archived_at ? null : <LessonReadinessBadge issues={readinessByLesson.get(lesson.id)} failed={readiness.isError} onOpen={() => setEditing({ lesson, isNew: false, issueCodes: readinessByLesson.get(lesson.id) })} onRetry={() => void readiness.refetch()} />} onEditLearningLesson={lesson => setEditing({ lesson, isNew: false })} learningTools={focusCourseIssue => <>
      {publication.data?.[0] && <Button type="button" variant="outline" size="sm" onClick={() => { const issue = publication.data[0]; if (!issue.lessonId) { focusCourseIssue(issue); return; } const lesson = bundle.data?.lessons.find(item => item.id === issue.lessonId); if (lesson) setEditing({ lesson, isNew: false, issues: publication.data.filter(item => item.lessonId === issue.lessonId) }); }}>{t("learning.fixPublication")}</Button>}
      {publication.isError && <Button type="button" variant="outline" size="sm" onClick={() => void publication.refetch()}>{t("learning.retryPublication")}</Button>}
      {firstIssue && firstIssueLesson && !readiness.isError && <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ lesson: firstIssueLesson, isNew: false, issueCodes: firstIssue.issues })}>{t("learning.fixFirst")}</Button>}
      <Link to={`/instructor/courses/${id}/preview`} className="text-sm text-primary underline">{t("learning.preview")}</Link>
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
