import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { I18nextProvider } from "react-i18next";
import i18n from "../../src/i18n";
import { CourseDetailLoading, CourseDetailError } from "../../src/pages/course-details/components/CourseDetailStates";
import { Button } from "../../src/components/ui/button";
import { Input } from "../../src/components/ui/input";
import { PublicCourseCard } from "../../src/components/courses/PublicCourseCard";
import { JobCard } from "../../src/features/jobs/JobCard";
import { ProjectCard } from "../../src/components/projects/ProjectCard";
import { CourseCurriculum } from "../../src/pages/course-details/components/CourseCurriculum";
import type { Course, CourseSection } from "../../src/types/courses";
import type { Job } from "../../src/types/jobs";
import type { Project } from "../../src/types/projects";
import "../../src/styles/globals.css";
import "../../src/styles/public-ui.css";
const course = { id: "fixture-course", slug: "fixture-course", title: "A long course title: TypeScript, AWS, AI and accessible applications for the next generation of builders", short_description: "Fixture content only. This card deliberately has a long title and a broken thumbnail to exercise layout and image fallback without creating any server records.", thumbnail_url: "/fixture-image-does-not-exist.png", level: "beginner", total_duration_seconds: 7200 } as Course;
const job = { id: "fixture-job", slug: "fixture-job", title: "Senior Software Engineer, Infrastructure and Developer Experience across distributed teams", company_name: "Example Company (fixture)", company_logo_url: null, job_type: "tech", remote_type: "remote", employment_type: "full_time", salary_min: 100000, salary_max: 250000, salary_currency: "USD", salary_period: "year", required_skills: ["typescript", "aws", "ai"], domains: [], primary_role: "backend-engineering", summary: "Local fixture. Buttons are inert; no application or account operation will be sent.", first_seen_at: "2026-09-06" } as Job;
const project = { id: "fixture-project", slug: "fixture-project", title: "Community project with a long title and no cover image", description: "Local fixture for the public card. No server data has been created.", source: "corelia", like_count: 0 } as unknown as Project;
export function Preview() {
 const [width,setWidth]=useState(390);const [dark,setDark]=useState(false);
 return <div className={dark ? "dark" : ""}>
  <div className="min-h-screen bg-surface-base text-foreground p-4">
   <div className="mb-6 flex flex-wrap gap-3"><label>Content width <select value={width} onChange={e=>setWidth(Number(e.target.value))}>{[360,390,768,1024,1440].map(w=><option key={w}>{w}</option>)}</select></label><button onClick={()=>setDark(!dark)}>Light / dark</button><button onClick={()=>void i18n.changeLanguage(i18n.language === "vi" ? "en" : "vi")}>VI / EN</button></div>
   <p className="mb-6">Local fixtures — no remote mutations. Width here is the component container, not the browser viewport.</p>
   <div className="public-ui mx-auto" style={{width,maxWidth:"100%"}}><div className="public-content"><section className="space-y-6">
    <h1>Public UI fixtures</h1>
    <section className="space-y-4"><h2>Interaction states (fixtures)</h2><div className="flex flex-wrap gap-3"><Button>Primary action</Button><Button variant="outline">Secondary action</Button><Button disabled>Disabled action</Button><Button variant="destructive">Destructive action</Button></div><label htmlFor="fixture-error">Invalid input</label><Input id="fixture-error" aria-invalid="true" aria-describedby="fixture-error-description" defaultValue="Invalid example"/><p id="fixture-error-description" className="text-destructive">Fixture validation message; no form submission.</p></section>
    <CourseDetailLoading/><CourseDetailError message="Fixture load failure. No network request was made."/><div className="grid gap-4" style={{gridTemplateColumns: `repeat(${width < 640 ? 1 : width < 1024 ? 2 : 3}, minmax(0,1fr))`}}><PublicCourseCard course={course} progress={{enrolled:true,percent:42}}/><JobCard publicAppearance job={job} onToggleSaved={()=>{}} onToggleApplied={()=>{}} onToggleHidden={()=>{}}/><ProjectCard project={project}/></div>
    <CourseCurriculum visibleLessonGroups={[{section:{id:"one",title:"First section: initially expanded"} as CourseSection,lessons:[]},{section:{id:"two",title:"Second section: initially collapsed"} as CourseSection,lessons:[]}]} isPaidUpfront={false} isPreviewOnlyCurriculum={false}/>
   </section></div></div>
  </div>
 </div>;
}
createRoot(document.getElementById("root")!).render(<I18nextProvider i18n={i18n}><MemoryRouter><Preview/></MemoryRouter></I18nextProvider>);
