import { expect, it, vi } from "vitest";
import type { Course, CourseLesson, Enrollment, FinalAssignmentSubmission, LessonProgress } from "@/types/courses";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/coreliaEdgeApi", () => ({ coreliaEdgeUrl: () => "", supabaseFunctionHeaders: () => ({}) }));
vi.mock("@/lib/finalAssignment", () => ({ getSubmission: vi.fn() }));
import { getSubmission } from "@/lib/finalAssignment";
import { courseCertificateCandidates } from "./courseCertificateCandidates";

it("preserves historical completion and requires the latest final approval for progress-only repair", async () => {
  const ids = ["history", "approved", "pending", "rejected", "missing", "legacy", "issued", "partial", "empty"];
  const lessons = [{ id: "one", published: true }, { id: "draft", published: false }, { id: "archived", published: true, archived_at: "2026-01-01" }] as CourseLesson[];
  const progress = [{ lesson_id: "one", completed_at: "2026-01-01" }, { lesson_id: "removed", completed_at: "2026-01-01" }] as LessonProgress[];
  vi.mocked(getSubmission).mockImplementation(async (_user, courseId) => courseId === "missing" ? null : { status: courseId } as FinalAssignmentSubmission);
  const result = await courseCertificateCandidates({
    userId: "learner", courseIds: ids, fallbackTitle: "Course",
    courses: new Map(ids.map(id => [id, { id, title: id, has_certificate: true, final_assignment_title: ["history", "approved", "pending", "rejected", "missing"].includes(id) ? "Project" : "" } as Course])),
    enrollments: [{ course_id: "history", completed_at: "2025-01-01" }, { course_id: "issued", completed_at: "2025-01-01", certificate_issued_at: "2025-01-02" }] as Enrollment[],
    progress: { courseIds: ids,
      lessonsByCourse: new Map(ids.map(id => [id, id === "empty" ? [] : id === "partial" ? Array.from({ length: 201 }, (_, index) => ({ id: String(index), published: true }) as CourseLesson) : lessons])),
      progressByCourse: new Map(ids.filter(id => id !== "history").map(id => [id, id === "partial" ? Array.from({ length: 200 }, (_, index) => ({ lesson_id: String(index), completed_at: "2026-01-01" }) as LessonProgress) : progress])),
    },
  });
  expect(result.map(item => item.courseId)).toEqual(["history", "approved", "legacy"]);
  expect(vi.mocked(getSubmission).mock.calls.map(call => call[1])).toEqual(["approved", "pending", "rejected", "missing"]);
});

it("does not treat a failed final-status read as eligible", async () => {
  vi.mocked(getSubmission).mockRejectedValue(new Error("Cannot read submission"));
  await expect(courseCertificateCandidates({
    userId: "learner", courseIds: ["course"], fallbackTitle: "Course", enrollments: [],
    courses: new Map([["course", { id: "course", has_certificate: true, final_assignment_title: "Project" } as Course]]),
    progress: { courseIds: ["course"], lessonsByCourse: new Map([["course", [{ id: "one", published: true } as CourseLesson]]]), progressByCourse: new Map([["course", [{ lesson_id: "one", completed_at: "2026-01-01" } as LessonProgress]]]) },
  })).rejects.toThrow("Cannot read submission");
});
