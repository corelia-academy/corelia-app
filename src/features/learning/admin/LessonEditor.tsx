import { useLearningConfirm } from "../useLearningConfirm";
import { invalidateLearningQuestions } from "../questionCache";
import { issueField } from "./issueField";
import { isQuizConfigShape, isQuizQuestionShape, recoverQuizQuestion } from "../quizShape";
import { normalizeLessonCopy } from "../lessonCopy";
import { normalizeCodeLocale } from "@/features/code-exercise/locale";
import { normalizeVideoLocale } from "../videoLocale";
import { learningSaveError, learningMutationIssues } from "../publishError";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLearningTranslation } from "@/features/learning/useLearningTranslation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LessonPlayerCard } from "@/pages/learn/components/LessonPlayerCard";
import { CodeExerciseBuilder } from "@/features/code-exercise/admin/CodeExerciseBuilder";
import { defaultCodeConfig, validateCodeConfig } from "@/features/code-exercise/config";
import { isCodeConfigShape } from "@/features/code-exercise/configShape";
import { evaluateCodeExercise } from "@/features/code-exercise/evaluate";
import { getLessonFormat } from "@/lib/lessonFormat";
import { getLessonQuestions } from "@/lib/sectionQuestions";
import { applyCourseLessonLocaleContent } from "@/lib/courses";
import { saveLearningLesson } from "@/lib/learning";
import type { Course, CourseLesson, CourseLessonLocaleContent, CourseSection, LessonFormat, SupportedCourseLocale } from "@/types/courses";
import type { SectionQuestion } from "@/types/questions";
import { QuizBuilder } from "./QuizBuilder";
import { PracticeBuilder } from "./PracticeBuilder";
import { isPracticeConfig } from "../practiceConfig";
import { TextField, Toggle, inputClass } from "./EditorFields";
import { validateLesson, validateLessonResources, validatePracticeFinalMapping, isLessonResourceList } from "../validation";
import { useAuth } from "@/stores/authStore";
import { duplicateLesson } from "./duplicateLesson";
import type { PublishValidationIssue } from "../types";
import { validateQuizQuestions } from "./quizValidation";

function issueControl(field: string): HTMLElement | null {
  const target = document.getElementById(`learning-${field}`);
  return target?.matches("input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled])") ? target : target?.querySelector<HTMLElement>("input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled])") ?? target;
}

type Locales = Partial<Record<SupportedCourseLocale, Partial<CourseLessonLocaleContent>>>;
type Props = { courseId: string; finalAssignment?: Pick<Course, "final_assignment_title" | "final_assignment_fields">; initial: CourseLesson; sections: CourseSection[]; nextLessonOrder: number; primaryLocale: SupportedCourseLocale; locales: Locales; isNew: boolean; initialIssueCodes?: string[]; initialIssues?: PublishValidationIssue[]; onDirtyChange?: (dirty: boolean) => void; onClose(): void; onSaved(): Promise<void> };
export function LessonEditor(props: Props) {
  const { t }=useLearningTranslation();const { user }=useAuth();
  const [openedFresh,setOpenedFresh]=useState(false);
  const query=useQuery({queryKey:["learning-editor-questions",props.courseId,props.initial.id,user?.id],queryFn:()=>getLessonQuestions(props.courseId,props.initial.id),enabled:!props.isNew && getLessonFormat(props.initial)==="quiz",refetchOnMount:"always",meta:{scope:"private",userId:user?.id}});
  // Latch the first fresh result; later refetches must not unmount a dirty form.
  if(!openedFresh&&query.isFetchedAfterMount&&query.isSuccess)setOpenedFresh(true);
  if(!props.isNew && getLessonFormat(props.initial)==="quiz" && !openedFresh)return <Dialog open onOpenChange={open=>!open&&props.onClose()}><DialogContent><DialogTitle>{t("learning.edit")}</DialogTitle><p>{t(query.isError?"learning.loadError":"learning.loading")}</p>{query.isError&&<Button onClick={()=>void query.refetch()}>{t("learning.retry")}</Button>}</DialogContent></Dialog>;
  return <Editor {...props} initialQuestions={query.data??[]} />;
}
function Editor({courseId,finalAssignment,initial,sections,nextLessonOrder,primaryLocale,locales:initialLocales,isNew,initialIssueCodes,initialIssues,onDirtyChange,onClose,onSaved,initialQuestions}:Props&{initialQuestions:SectionQuestion[]}) {
  const { t }=useLearningTranslation();
  const client=useQueryClient();
  const [lesson,setLesson]=useState<CourseLesson>({...initial,lesson_format:getLessonFormat(initial)});
  const [locales,setLocales]=useState<Locales>(initialLocales);
  const [locale,setLocale]=useState(initialIssues?.[0]?.locale??primaryLocale);
  const [questions,setQuestions]=useState(initialQuestions);
  const [preview,setPreview]=useState(false);
  const [error,setError]=useState<string|null>(()=>initialIssueCodes?.length?initialIssueCodes.map(code=>t(`learning.validation.${code}`,{defaultValue:code})).join(" · "):null);
  const [issues,setIssues]=useState<PublishValidationIssue[]>(()=>{
    if(initialIssues?.length)return initialIssues;
    if(!initialIssueCodes?.length)return [];
    const result=validateLesson(initial);
    if(finalAssignment)result.push(...validatePracticeFinalMapping(initial,finalAssignment));
    if(getLessonFormat(initial)==="quiz")result.push(...validateQuizQuestions(initial.id,initialQuestions));
    result.push(...validateLessonResources(initial.resources??[],initial.id,primaryLocale,true));
    for(const lang of ["vi","en"] as const)if(lang!==primaryLocale)result.push(...validateLessonResources(initialLocales[lang]?.resources??[],initial.id,lang,true));
    // Directory availability is server-only; retain those issue codes even when
    // local structural validation cannot reproduce them.
    for(const code of initialIssueCodes)if(!result.some(issue=>issue.code===code)){
      const format=getLessonFormat(initial);
      const field=format==="practice"?"practice_config":format==="code_exercise"?"code_exercise_config":"lesson_format";
      result.push({code,field,lessonId:initial.id,panel:"content"});
    }
    return result;
  });
  const [focusRequest,setFocusRequest]=useState<{field:string}|null>(()=>issues[0]?{field:issueField(issues[0],initial)}:null);
  useEffect(()=>{
    if(!focusRequest)return;
    const target=document.getElementById(`learning-${focusRequest.field}`);
    issueControl(focusRequest.field)?.focus();
    target?.scrollIntoView?.({block:"center",behavior:"smooth"});
  },[focusRequest]);
  const fixIssue=(issue:PublishValidationIssue)=>{setPreview(false);setLocale(issue.locale??primaryLocale);setFocusRequest({field:issueField(issue,lesson)});};
  const mutation=useMutation({mutationFn:async()=>{const saved=await saveLearningLesson(courseId,lesson,lesson.lesson_format==="quiz"?questions:undefined,locales);if(lesson.lesson_format==="quiz")await invalidateLearningQuestions(client,courseId);return saved;},onSuccess:async()=>{await onSaved();onClose();}});
  const dirty=JSON.stringify(lesson)!==JSON.stringify({...initial,lesson_format:getLessonFormat(initial)})||JSON.stringify(locales)!==JSON.stringify(initialLocales)||JSON.stringify(questions)!==JSON.stringify(initialQuestions);
  useEffect(()=>{onDirtyChange?.(dirty);return()=>onDirtyChange?.(false);},[dirty,onDirtyChange]);
  const master=locale===primaryLocale;
  const invalidQuiz=lesson.lesson_format==="quiz"&&!isQuizConfigShape(lesson.quiz_config);
  const invalidQuestions=lesson.lesson_format==="quiz"&&questions.some(question=>!isQuizQuestionShape(question));
  const displayQuestions=questions.map(recoverQuizQuestion);
  const invalidCode=lesson.lesson_format==="code_exercise" && !isCodeConfigShape(lesson.code_exercise_config);
  const invalidPractice=lesson.lesson_format==="practice" && lesson.practice_config!=null && !isPracticeConfig(lesson.practice_config);
  const localized=locales[locale]??{};
  const copySource=master?lesson:localized;
  const codeCopy=normalizeCodeLocale(copySource.code_exercise_locale);
  const videoCopy=normalizeVideoLocale(copySource);
  const textCopy=normalizeLessonCopy(copySource);
  const invalidCopy=textCopy.invalid||codeCopy.invalid||videoCopy.invalid||(master&&(normalizeLessonCopy(localized).invalid||normalizeCodeLocale(localized.code_exercise_locale).invalid||normalizeVideoLocale(localized).invalid));
  const { confirm, confirmation } = useLearningConfirm();
  const patch=(p:Partial<CourseLesson>)=>setLesson(l=>({...l,...p}));
  const localPatch=(p:Partial<CourseLessonLocaleContent>)=>setLocales(l=>({...l,[locale]:{...l[locale],...p}}));
  const editContent=(field:"title"|"description_markdown"|"short_description",value:string)=>master?patch({[field]:value}):localPatch({[field]:value});
  const sourceDisplay=master?lesson:applyCourseLessonLocaleContent(lesson,{...localized,locale,title:localized.title??lesson.title});
  const display={...sourceDisplay,...normalizeLessonCopy(sourceDisplay).value};
  async function save(){
    setError(null);
    const codeErrors=lesson.lesson_format==="code_exercise"?validateCodeConfig(lesson.code_exercise_config,Boolean(lesson.published)):[];
    const nextIssues:PublishValidationIssue[]=lesson.published?validateLesson(lesson):codeErrors.map(code=>({lessonId:lesson.id,field:"code_exercise_config",code}));
    if(lesson.published&&finalAssignment)nextIssues.push(...validatePracticeFinalMapping(lesson,finalAssignment));
    if(invalidQuiz)nextIssues.push({lessonId:lesson.id,field:"quiz_config",code:"invalid_config"});
    if(invalidQuestions)nextIssues.push({lessonId:lesson.id,field:"questions",code:"invalid_options"});
    if(invalidPractice&&!lesson.published)nextIssues.push({lessonId:lesson.id,field:"practice_config",code:"invalid_config"});
    if(lesson.published&&lesson.lesson_format==="quiz")nextIssues.push(...validateQuizQuestions(lesson.id,questions));
    nextIssues.push(...validateLessonResources(lesson.resources??[],lesson.id,primaryLocale,Boolean(lesson.published)));
    for(const lang of ["vi","en"] as const)if(lang!==primaryLocale)nextIssues.push(...validateLessonResources(locales[lang]?.resources??[],lesson.id,lang,Boolean(lesson.published)));
    for(const [lang, source] of [[primaryLocale,lesson],...(["vi","en"] as const).map(lang=>[lang,locales[lang]??{}] as const)] as const){
      if(normalizeLessonCopy(source).invalid||normalizeCodeLocale(source.code_exercise_locale).invalid||normalizeVideoLocale(source).invalid)nextIssues.push({lessonId:lesson.id,locale:lang,panel:"content",field:"locale_copy",code:"invalid_locale_copy"});
    }
    setIssues(nextIssues);
    if(nextIssues.length)return;
    if(lesson.published&&lesson.code_exercise_config?.mode==="edit"&&evaluateCodeExercise(lesson.code_exercise_config,{source:lesson.code_exercise_config.file.starter_source}).passed&&!await confirm(t("learning.starterPassConfirm")))return;
    try{await mutation.mutateAsync();}catch(e){setIssues(learningMutationIssues(e,lesson.id));setError(learningSaveError(e,t,[lesson]));}
  }
  const close=async()=>{if(!dirty||await confirm(t("learning.dirtyConfirm")))onClose();};
  const duplicate=()=>{
    const copy=duplicateLesson(lesson,questions,locales,nextLessonOrder,(title,lng)=>t("learning.copyTitle",{title,lng:lng??primaryLocale}));
    setLesson(copy.lesson);setQuestions(copy.questions);setLocales(copy.locales);setPreview(false);setError(null);setIssues([]);
  };
  const questionCopy=normalizeLessonCopy(localized).value.question_copy;
  const previewQuestions=displayQuestions.map(q=>({...q,question:questionCopy?.[q.id]?.question??q.question,explanation:questionCopy?.[q.id]?.explanation??q.explanation,options:q.options.map(o=>({...o,text:questionCopy?.[q.id]?.options?.[o.id]??o.text}))}));
  return <>{confirmation}<Dialog open onOpenChange={open=>!open&&close()}><DialogContent initialFocus={() => issues[0] ? issueControl(issueField(issues[0],initial)) ?? true : true} className="w-full max-w-5xl"><DialogTitle>{isNew?t("learning.addLesson"):`${t("learning.edit")} · ${lesson.title}`}</DialogTitle><DialogDescription>{t("learning.reviewCourseOnly")}</DialogDescription>
    {!isNew&&lesson.id===initial.id&&<Button type="button" variant="outline" disabled={mutation.isPending} onClick={duplicate}>{t("learning.duplicateDraft")}</Button>}
    {lesson.id!==initial.id&&<p role="status">{t("learning.duplicateUnsaved")}</p>}
    <div className="flex flex-wrap items-center gap-3"><select aria-label={t("learning.localization")} className={`${inputClass} w-auto`} value={locale} onChange={e=>setLocale(e.target.value as SupportedCourseLocale)}><option value="vi">Tiếng Việt</option><option value="en">English</option></select><Button type="button" variant="outline" disabled={invalidPractice||invalidCode||invalidQuestions||invalidQuiz} onClick={()=>setPreview(p=>!p)}>{t("learning.preview")}</Button>{master&&<Toggle label={t("learning.published")} checked={lesson.published??false} onChange={published=>patch({published})}/>}</div>
    {preview?<><p>{t("learning.unsavedPreview")}</p><LessonPlayerCard lesson={display} lessonIndex={0} courseId={courseId} mode="preview" contentLocale={locale} completed={false} isDraftLesson={false} hasFullCourseAccess previousLesson={null} nextLesson={null} translate={key=>String(t(key))} onMarkComplete={async()=>{}} onNavigateToLesson={()=>{}} questions={lesson.lesson_format==="quiz"?previewQuestions:undefined}/></>:<div className="space-y-5">
      {invalidCopy&&<div id="learning-locale_copy" tabIndex={-1} className="space-y-3 rounded-lg border border-destructive/30 p-3"><p role="alert">{t("learning.invalidCopyRecovery")}</p><Button type="button" variant="outline" onClick={async()=>{
        if(!await confirm(t("learning.recoverCopyConfirm")))return;
        const recovered={...textCopy.value,code_exercise_locale:codeCopy.value,video_primary_locale:videoCopy.value.video_primary_locale??primaryLocale,has_subtitle:videoCopy.value.has_subtitle??false,subtitle_locales:videoCopy.value.subtitle_locales??[]};
        if(master){patch({...recovered,published:false});const primaryCopy=locales[primaryLocale];if(primaryCopy){const normalizedVideo=normalizeVideoLocale(primaryCopy).value;setLocales(previous=>({...previous,[primaryLocale]:{...primaryCopy,...normalizeLessonCopy(primaryCopy).value,code_exercise_locale:normalizeCodeLocale(primaryCopy.code_exercise_locale).value,video_primary_locale:normalizedVideo.video_primary_locale??primaryLocale,has_subtitle:normalizedVideo.has_subtitle??false,subtitle_locales:normalizedVideo.subtitle_locales??[]}}));}}
        else{localPatch(recovered);patch({published:false});}
        setIssues([]);setError(null);
      }}>{t("learning.recoverCopy")}</Button></div>}
      <TextField id="learning-title" label={t("learning.title")} value={display.title} onChange={v=>editContent("title",v)}/>
      <TextField label={t("learning.shortDescription")} value={display.short_description??""} onChange={v=>editContent("short_description",v)}/>
      <TextField id="learning-description_markdown" label={t("learning.description")} multiline value={display.description_markdown??""} onChange={v=>editContent("description_markdown",v)}/>
      {master&&<><label className="block text-sm">{t("learning.section")}<select className={inputClass} value={lesson.section_id} onChange={e=>patch({section_id:e.target.value})}>{sections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label className="block text-sm">{t("learning.format")}<select id="learning-lesson_format" className={inputClass} value={lesson.lesson_format} disabled={!isNew&&!["article","video"].includes(getLessonFormat(initial))} onChange={async e=>{const format=e.target.value as LessonFormat;if(!isNew&&!await confirm(t("learning.dirtyConfirm")))return;patch({lesson_format:format,...(format==="code_exercise"&&!lesson.code_exercise_config?{code_exercise_config:defaultCodeConfig()}:{}),...(format==="practice"&&!lesson.practice_config?{practice_config:{mode:"instruction" as const}}:{})});}}>{(isNew?["article","video","quiz","practice","code_exercise"]:["article","video"].includes(getLessonFormat(initial))?["article","video"]:[getLessonFormat(initial)]).map(f=><option key={f} value={f}>{t(`learning.formats.${f}`)}</option>)}</select></label></>}
      {lesson.lesson_format==="video"&&<><TextField id="learning-youtube_url" label={t("learning.youtubeUrl")} value={display.youtube_url??""} onChange={youtube_url=>master?patch({youtube_url}):localPatch({youtube_url})}/><TextField label={t("learning.startSeconds")} type="number" value={String(display.youtube_start_seconds??0)} onChange={v=>master?patch({youtube_start_seconds:Number(v)}):localPatch({youtube_start_seconds:Number(v)})}/><TextField id="learning-youtube_end_seconds" label={t("learning.endSeconds")} type="number" value={display.youtube_end_seconds==null?"":String(display.youtube_end_seconds)} onChange={v=>master?patch({youtube_end_seconds:v?Number(v):null}):localPatch({youtube_end_seconds:v?Number(v):null})}/></>}
      {lesson.lesson_format==="quiz"&&(invalidQuestions||invalidQuiz?<div id={invalidQuiz?"learning-quiz_config":"learning-questions"} tabIndex={-1}><p role="alert">{t("learning.invalidQuestionsRecovery")}</p><Button type="button" onClick={async()=>{if(!await confirm(t("learning.recoverQuestionsConfirm")))return;setQuestions(displayQuestions);patch({published:false,...(invalidQuiz?{quiz_config:{passing_ratio:typeof lesson.quiz_config?.passing_ratio==="number"?lesson.quiz_config.passing_ratio:0.7,allow_retry:typeof lesson.quiz_config?.allow_retry==="boolean"?lesson.quiz_config.allow_retry:true}}:{})});setLocale(primaryLocale);}}>{t("learning.recoverQuestions")}</Button></div>:master?<><TextField id="learning-quiz_config" label={t("learning.passingScore")} type="number" value={String((lesson.quiz_config?.passing_ratio??0.7)*100)} onChange={v=>patch({quiz_config:{allow_retry:lesson.quiz_config?.allow_retry??true,passing_ratio:Number(v)/100}})}/><Toggle label={t("learning.allowRetry")} checked={lesson.quiz_config?.allow_retry!==false} onChange={allow_retry=>patch({quiz_config:{passing_ratio:lesson.quiz_config?.passing_ratio??0.7,allow_retry}})}/><QuizBuilder questions={questions} onChange={setQuestions} courseId={courseId} lessonId={lesson.id}/></>:questions.map(q=><div key={q.id} className="space-y-3 rounded-xl border border-border p-4"><TextField label={t("learning.question")} value={questionCopy?.[q.id]?.question??q.question} onChange={question=>localPatch({question_copy:{...localized.question_copy,[q.id]:{...questionCopy?.[q.id],question}}})}/>{q.options.map(o=><TextField key={o.id} label={t("learning.option")} value={questionCopy?.[q.id]?.options?.[o.id]??o.text} onChange={value=>localPatch({question_copy:{...localized.question_copy,[q.id]:{...questionCopy?.[q.id],options:{...questionCopy?.[q.id]?.options,[o.id]:value}}}})}/>)}<TextField label={t("learning.explanation")} value={questionCopy?.[q.id]?.explanation??q.explanation??""} onChange={explanation=>localPatch({question_copy:{...localized.question_copy,[q.id]:{...questionCopy?.[q.id],explanation}}})}/></div>))}
      {lesson.lesson_format==="practice"&&(invalidPractice?<div id="learning-practice_config" tabIndex={-1} className="space-y-3 rounded-lg border border-destructive/30 p-3"><p role="alert">{t("learning.invalidPracticeRecovery")}</p>{master?<Button type="button" variant="outline" onClick={async()=>{if(await confirm(t("learning.resetPracticeConfirm"))){patch({practice_config:{mode:"instruction"},published:false});setIssues([]);setError(null);}}}>{t("learning.resetPracticeConfig")}</Button>:<Button type="button" variant="outline" onClick={()=>setLocale(primaryLocale)}>{t("learning.editMasterConfig")}</Button>}</div>:master?<PracticeBuilder config={lesson.practice_config??{mode:"instruction"}} onChange={practice_config=>patch({practice_config})}/>:<>{lesson.practice_config?.checklist_items?.map(item=><TextField key={item.id} label={item.label} value={localized.practice_copy?.[item.id]?.label??item.label} onChange={label=>localPatch({practice_copy:{...localized.practice_copy,[item.id]:{label}}})}/>)}{lesson.practice_config?.project_steps?.map(step=><div key={step.id}><TextField label={t("learning.title")} value={localized.practice_copy?.[step.id]?.title??step.title} onChange={title=>localPatch({practice_copy:{...localized.practice_copy,[step.id]:{...localized.practice_copy?.[step.id],title}}})}/><TextField label={t("learning.instructions")} multiline value={localized.practice_copy?.[step.id]?.instructions_markdown??step.instructions_markdown??""} onChange={instructions_markdown=>localPatch({practice_copy:{...localized.practice_copy,[step.id]:{...localized.practice_copy?.[step.id],instructions_markdown}}})}/></div>)}</>)}
      {lesson.lesson_format==="code_exercise"&&(invalidCode?<div id="learning-code_exercise_config" tabIndex={-1} className="space-y-3 rounded-lg border border-destructive/30 p-3"><p role="alert">{t("learning.invalidCodeRecovery")}</p>{master?<Button type="button" variant="outline" onClick={async()=>{if(await confirm(t("learning.resetCodeConfirm"))){patch({code_exercise_config:defaultCodeConfig(),published:false});setIssues([]);setError(null);}}}>{t("learning.resetCodeConfig")}</Button>:<Button type="button" variant="outline" onClick={()=>setLocale(primaryLocale)}>{t("learning.editMasterConfig")}</Button>}</div>:lesson.code_exercise_config&&(master?<CodeExerciseBuilder config={lesson.code_exercise_config} onChange={code_exercise_config=>patch({code_exercise_config})}/>:invalidCopy?null:<><TextField label={t("learning.hints")} multiline value={(localized.code_exercise_locale?.hints??lesson.code_exercise_config.hints??[]).join("\n")} onChange={value=>localPatch({code_exercise_locale:{...localized.code_exercise_locale,hints:value.split("\n")}})}/>{lesson.code_exercise_config.blanks?.map(b=><TextField key={b.id} label={`${t("learning.feedback")} · ${b.id}`} value={localized.code_exercise_locale?.blank_feedback?.[b.id]??b.feedback??""} onChange={value=>localPatch({code_exercise_locale:{...localized.code_exercise_locale,blank_feedback:{...localized.code_exercise_locale?.blank_feedback,[b.id]:value}}})}/>)}{lesson.code_exercise_config.tests?.map(test=><div key={test.id}><TextField id={`learning-test-${test.id}-description`} label={t("learning.description")} value={localized.code_exercise_locale?.test_copy?.[test.id]?.description??test.description} onChange={description=>localPatch({code_exercise_locale:{...localized.code_exercise_locale,test_copy:{...localized.code_exercise_locale?.test_copy,[test.id]:{...localized.code_exercise_locale?.test_copy?.[test.id],description}}}})}/><TextField label={t("learning.feedback")} value={localized.code_exercise_locale?.test_copy?.[test.id]?.failure_message??test.failure_message??""} onChange={failure_message=>localPatch({code_exercise_locale:{...localized.code_exercise_locale,test_copy:{...localized.code_exercise_locale?.test_copy,[test.id]:{...localized.code_exercise_locale?.test_copy?.[test.id],failure_message}}}})}/></div>)}</>))}
      {!isLessonResourceList(display.resources??[]) ? <div id="learning-resources" tabIndex={-1} className="space-y-3 rounded-lg border border-destructive/30 p-3"><p role="alert">{t("learning.invalidResourcesRecovery")}</p><Button type="button" variant="outline" onClick={async()=>{if(await confirm(t("learning.recoverResourcesConfirm"))){const resources=Array.isArray(display.resources)?display.resources.filter(resource=>isLessonResourceList([resource])):[];if(master)patch({resources,published:false});else{localPatch({resources});patch({published:false});}setIssues([]);setError(null);}}}>{t("learning.recoverResources")}</Button></div> : <>
      {(display.resources??[]).map((r,i)=><div key={i} className="grid gap-2 sm:grid-cols-2"><TextField id={`learning-resource-${i}-title`} label={t("learning.title")} value={r.title} onChange={title=>{const resources=(display.resources??[]).map((v,j)=>i===j?{...v,title}:v);if(master) patch({resources}); else localPatch({resources});}}/><TextField id={`learning-resource-${i}-url`} label="URL" value={r.url} onChange={url=>{const resources=(display.resources??[]).map((v,j)=>i===j?{...v,url}:v);if(master) patch({resources}); else localPatch({resources});}}/><Button type="button" variant="ghost" className="sm:col-span-2" onClick={()=>{const resources=(display.resources??[]).filter((_,index)=>index!==i);if(master)patch({resources});else localPatch({resources});}}>{t("learning.removeResource",{number:i+1})}</Button></div>)}<Button type="button" variant="outline" onClick={()=>{const resources=[...display.resources??[],{title:"",url:""}];if(master) patch({resources}); else localPatch({resources});}}>{t("learning.addResource")}</Button></>}
    </div>}
    {issues.length>0&&<div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3">
      <Button type="button" variant="outline" onClick={()=>fixIssue(issues[0])}>{t("learning.fixFirst")}</Button>
      <ul className="space-y-1">{issues.map((issue,index)=><li key={`${issue.field}:${issue.code}:${index}`}><button type="button" className="text-left text-sm text-destructive underline" onClick={()=>fixIssue(issue)}>{t(`learning.validation.${issue.code}`,{defaultValue:issue.code})}</button></li>)}</ul>
    </div>}
    {error&&<p role="alert" className="text-destructive">{error}</p>}<div className="sticky bottom-0 flex justify-end gap-3 border-t border-border bg-surface-float pt-4"><Button type="button" variant="outline" onClick={close}>{t("learning.cancel")}</Button><Button type="button" disabled={mutation.isPending} onClick={()=>void save()}>{t(mutation.isPending?"learning.saving":"learning.save")}</Button></div>
  </DialogContent></Dialog>
  </>;
}
