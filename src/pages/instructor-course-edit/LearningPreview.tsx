import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { getLearningPreview } from "@/lib/learning";
import { LessonPlayerCard } from "@/pages/learn/components/LessonPlayerCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/authStore";
export default function LearningPreview(){
  const {id:courseId,lessonId}=useParams();const {user}=useAuth();const {t}=useLearningTranslation();const [locale,setLocale]=useState<"vi"|"en">("vi");const [mobile,setMobile]=useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const editorPath = `/instructor/courses/${courseId}/edit`;
  const origin = location.state?.editorLocation;
  const hasEditorOrigin = origin?.pathname === editorPath;
  const returnTo = hasEditorOrigin
    ? `${editorPath}${origin.search || ""}${origin.hash || ""}`
    : `${editorPath}#content`;
  const query=useQuery({queryKey:["learning-preview",courseId,lessonId,locale,user?.id],queryFn:()=>getLearningPreview(courseId!,lessonId,locale),enabled:!!courseId});
  return <div className="space-y-4 p-4"><div className="flex items-center gap-3"><Link to={returnTo} replace onClick={event => {
    if (hasEditorOrigin && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      void navigate(-1);
    }
  }}>{t("learning.back")}</Link><select aria-label={t("learning.localization")} value={locale} onChange={e=>setLocale(e.target.value as "vi"|"en")}><option value="vi">Tiếng Việt</option><option value="en">English</option></select><Button variant="outline" onClick={()=>setMobile(v=>!v)}>{t(mobile?"learning.desktop":"learning.mobile")}</Button></div>{query.isPending?<p>{t("learning.loading")}</p>:query.isError?<p role="alert">{t("learning.loadError")}</p>:<div className={mobile?"mx-auto max-w-sm border border-border":""}><LessonPlayerCard lesson={query.data?.lesson??null} lessonIndex={0} courseId={courseId} mode="preview" contentLocale={locale} completed={false} isDraftLesson={false} hasFullCourseAccess previousLesson={null} nextLesson={null} translate={key=>String(t(key))} onMarkComplete={async()=>{}} onNavigateToLesson={()=>{}}/></div>}</div>;
}
