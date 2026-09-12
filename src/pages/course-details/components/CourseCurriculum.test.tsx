// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CourseCurriculum } from "./CourseCurriculum";
import type { CourseLesson, CourseSection, LessonFormat } from "@/types/courses";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: {count?: number}) => `${key}${options?.count === undefined ? "" : `:${options.count}`}` }) }));
vi.mock("@/i18n", () => ({ default: { language: "vi", t: (key: string) => key } }));
it.each([true,false])("shows all five lesson formats in the %s section layout", hasSections => {
 const formats: LessonFormat[]=["article","video","quiz","practice","code_exercise"];
 const lessons=formats.map((format,index)=>({id:String(index),title:`Lesson ${format}`,lesson_format:format,published:true,duration_seconds:0}) as CourseLesson);
 const container=document.createElement("div"), root=createRoot(container);
 try {
  act(()=>root.render(<CourseCurriculum visibleLessonGroups={[{section:{id:"section",title:"Section"} as CourseSection,lessons}]} isPaidUpfront={false} isPreviewOnlyCurriculum={false} hasSections={hasSections} />));
  for(const format of formats)expect(container.textContent).toContain(`Lesson ${format}`);
  if(hasSections)expect(container.textContent).toContain("detail.courseDetail.lessonCountShort:5");
 }finally{act(()=>root.unmount());}
});
