// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CourseCurriculum } from "./CourseCurriculum";
import { getCourseContentLessons } from "../utils/contentLessons";
import type { CourseLesson, CourseSection, LessonFormat } from "@/types/courses";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: {count?: number}) => `${key}${options?.count === undefined ? "" : `:${options.count}`}` }) }));
vi.mock("@/i18n", () => ({ default: { language: "vi", t: (key: string) => key } }));
it.each([true,false])("shows only content lessons in the %s section layout", hasSections => {
 const formats: LessonFormat[]=["article","video","quiz","practice","code_exercise"];
 const lessons=formats.map((format,index)=>({id:String(index),title:`Lesson ${format}`,lesson_format:format,published:true,duration_seconds:0}) as CourseLesson);
 const contentLessons=getCourseContentLessons(lessons);
 const container=document.createElement("div"), root=createRoot(container);
 try {
  act(()=>root.render(<CourseCurriculum visibleLessonGroups={[{section:{id:"section",title:"Section"} as CourseSection,lessons:contentLessons}]} isPaidUpfront={false} isPreviewOnlyCurriculum={false} hasSections={hasSections} />));
  for(const format of ["article","video"])expect(container.textContent).toContain(`Lesson ${format}`);
  for(const format of ["quiz","practice","code_exercise"])expect(container.textContent).not.toContain(`Lesson ${format}`);
  if(hasSections)expect(container.textContent).toContain("detail.courseDetail.lessonCountShort:2");
 }finally{act(()=>root.unmount());}
});
