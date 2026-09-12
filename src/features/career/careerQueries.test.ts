import { QueryClient } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import type { CourseLesson, Enrollment, LessonProgress } from "@/types/courses";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/coreliaEdgeApi", () => ({ coreliaEdgeUrl: () => "", supabaseFunctionHeaders: () => ({}) }));
vi.mock("@/lib/courses", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/courses")>(),
  getMyEnrollments: vi.fn(),
  getLearnerCourseProgressSnapshot: vi.fn(),
}));
import { getMyEnrollments, getLearnerCourseProgressSnapshot } from "@/lib/courses";
import { careerProgressQueryOptions } from "./careerQueries";

it("uses published lesson identities and server course completion, including historical completions", async () => {
  const lesson = (id: string, extra = {}) => ({ id, title: id, published: true, ...extra }) as CourseLesson;
  const progress = (lesson_id: string) => ({ lesson_id, completed_at: "2026-01-01" }) as LessonProgress;
  const ids = ["learning", "pending", "historic", "new", "not-enrolled"];
  vi.mocked(getMyEnrollments).mockResolvedValue(ids.filter(id => id !== "not-enrolled").map(course_id => ({ course_id, completed_at: course_id === "historic" ? "2025-01-01" : null })) as Enrollment[]);
  vi.mocked(getLearnerCourseProgressSnapshot).mockResolvedValue({
    courseIds: ids,
    lessonsByCourse: new Map([
      ["learning", [lesson("one"), lesson("two"), lesson("draft", { published: false }), lesson("archived", { archived_at: "2026-01-01" })]],
      ["pending", [lesson("one")]],
      ["historic", [lesson("one"), lesson("new-required")]],
      ["new", [lesson("one"), lesson("two")]],
    ]),
    progressByCourse: new Map([
      ["learning", [progress("one"), progress("one"), progress("draft"), progress("archived"), progress("removed")]],
      ["pending", [progress("one")]],
      ["historic", [progress("one")]],
    ]),
  });
  const client = new QueryClient();
  try {
    const result = await client.fetchQuery(careerProgressQueryOptions(ids, "learner"));
    expect(result.get("learning")).toEqual({ enrolled: true, completedLessons: 1, totalLessons: 2, progressPercent: 50, completed: false });
    expect(result.get("pending")).toEqual({ enrolled: true, completedLessons: 1, totalLessons: 1, progressPercent: 100, completed: false });
    expect(result.get("historic")).toEqual({ enrolled: true, completedLessons: 1, totalLessons: 2, progressPercent: 50, completed: true });
    expect(result.get("new")).toEqual({ enrolled: true, completedLessons: 0, totalLessons: 2, progressPercent: 0, completed: false });
    expect(result.has("not-enrolled")).toBe(false);
    expect(getLearnerCourseProgressSnapshot).toHaveBeenCalledWith("learner", [...ids].sort());
  } finally { client.clear(); }
});
