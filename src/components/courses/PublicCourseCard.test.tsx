// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Course } from "@/types/courses";
import { PublicCourseCard } from "./PublicCourseCard";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

const COVER = 'viewBox="0 0 320 180"';

const base = { id: "c1", slug: "c1", title: "T", level: "beginner", total_duration_seconds: 0, thumbnail_url: "" } as unknown as Course;
const render = (course: Course) => renderToStaticMarkup(
  <MemoryRouter><TooltipProvider>
    <PublicCourseCard course={course} participantPreview={{ count: 0, participants: [] }} variant="catalog" lessonCount={1} />
  </TooltipProvider></MemoryRouter>,
);

it("draws the hand-drawn cover for an AI course without a thumbnail", () => {
  const html = render({ ...base, course_type: "ai_generated" });
  expect(html).toContain(COVER);
  expect(html).not.toContain("<img");
});

it("keeps the thumbnail image for an AI course that has one", () => {
  const html = render({ ...base, course_type: "ai_generated", thumbnail_url: "https://x.test/a.png" });
  expect(html).toContain("<img");
});

it("keeps the book icon for a non-AI course without a thumbnail", () => {
  expect(render(base)).not.toContain(COVER);
});
