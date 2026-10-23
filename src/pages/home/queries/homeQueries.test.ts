import { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/i18n", () => ({ default: { language: "en", resolvedLanguage: "en", t: (key: string) => key } }));

const reads = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@/lib/courses", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/courses")>();
  const record = <T,>(name: string, value: T) => async (...args: unknown[]) => {
    reads.calls.push(`${name}:${JSON.stringify(args)}`);
    return value;
  };
  const lesson = (id: string, courseId: string, order: number) =>
    ({ id, section_id: `${courseId}-s1`, order, title: id, published: true, duration_seconds: 60 });
  return {
    ...actual,
    getMyEnrollments: record("enrollments", [
      { id: "e1", course_id: "c1", last_accessed_at: "2026-10-01T00:00:00Z", last_lesson_id: null },
      { id: "e2", course_id: "c2", last_accessed_at: "2026-10-02T00:00:00Z", last_lesson_id: null },
      { id: "e3", course_id: "c3", last_accessed_at: "2026-10-03T00:00:00Z", last_lesson_id: null },
    ]),
    getCoursesByIds: record("courses", new Map([
      ["c1", { id: "c1", title: "Course 1" }],
      ["c2", { id: "c2", title: "Course 2" }],
    ])),
    getCourseLessonsByCourseIds: record("lessons", new Map([
      ["c1", [lesson("l1", "c1", 0), lesson("l2", "c1", 1)]],
      ["c2", [lesson("l3", "c2", 0)]],
    ])),
    getCourseSectionsByCourseIds: record("sections", new Map([
      ["c1", [{ id: "c1-s1", order: 0, title: "S" }]],
      ["c2", [{ id: "c2-s1", order: 0, title: "S" }]],
    ])),
    getLessonProgressForCourses: record("progress", new Map([
      ["c1", [{ id: "p1", lesson_id: "l1", course_id: "c1", completed: true, completed_at: "2026-10-01T00:00:00Z" }]],
      ["c2", []],
    ])),
  };
});
vi.mock("@/lib/intl", () => ({ intlLocale: () => "en" }));

import { homeDashboardQueryOptions } from "./homeQueries";

it("loads the continue-learning cards with one read per table", async () => {
  const t = ((key: string) => key) as unknown as TFunction<"common">;
  const user = { id: "u1" } as User;
  const result = await new QueryClient().fetchQuery(homeDashboardQueryOptions(user, "en", t));

  const tables = reads.calls.map((call) => call.split(":")[0]);
  expect(tables.sort()).toEqual(["courses", "enrollments", "lessons", "progress", "sections"]);
  for (const name of ["courses", "lessons", "sections"]) {
    expect(reads.calls.find((call) => call.startsWith(`${name}:`))).toBe(`${name}:[["c1","c2"]]`);
  }
  expect(result.enrolledCourseCount).toBe(3);
  expect(result.focusCards.map((card) => [card.id, card.lessonCount])).toEqual([["c1", 2], ["c2", 1]]);
});
