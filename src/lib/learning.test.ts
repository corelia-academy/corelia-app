import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearningQuiz, getLearningCourseRoster, saveLearningLesson } from "./learning";
import { getCourseLessonLocaleContentMap, getLessonProgressForCourse } from "./courses";
import { getLessonQuestions } from "./sectionQuestions";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("./courses", () => ({ getCourseLessonLocaleContentMap: vi.fn(), getLessonProgressForCourse: vi.fn() }));
vi.mock("./sectionQuestions", () => ({ getLessonQuestions: vi.fn() }));

const failedAttempt = { id: "attempt", user_id: "user", course_id: "course", lesson_id: "lesson", question_id: "question", selected_index: 1, is_correct: false, attempted_at: "2026-09-11T00:00:00Z", attempt_group_id: "group", group_total: 1, group_correct: 0, passing_ratio: 0.7 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLessonQuestions).mockResolvedValue([]);
  vi.mocked(getCourseLessonLocaleContentMap).mockResolvedValue(new Map());
  vi.mocked(getLessonProgressForCourse).mockResolvedValue([]);
  const query = { select: vi.fn(), eq: vi.fn(), not: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.not.mockReturnValue(query);
  query.order.mockReturnValueOnce(query).mockResolvedValueOnce({ data: [failedAttempt], error: null });
  vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
});

describe("course roster", () => {
  it("keeps withheld email null and passes the course and cancellation signal", async () => {
    const participant = { id: "learner", full_name: "Learner", avatar_url: null, email: null, progress_percent: 75 };
    const abortSignal = vi.fn().mockResolvedValue({ data: [participant], error: null });
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal } as unknown as ReturnType<typeof supabase.rpc>);
    const controller = new AbortController();
    expect(await getLearningCourseRoster("course", controller.signal)).toEqual([participant]);
    expect(supabase.rpc).toHaveBeenCalledWith("learning_course_roster", { p_course: "course" });
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it("surfaces permission errors instead of rendering a misleading empty roster", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "COURSE_ROSTER_PERMISSION_REQUIRED" } } as never);
    await expect(getLearningCourseRoster("other-course")).rejects.toThrow("COURSE_ROSTER_PERMISSION_REQUIRED");
  });
});

describe("restored quiz completion", () => {
  it("does not infer completion from the existence of a failed attempt", async () => {
    const { result } = await getLearningQuiz("course", "lesson", "user", "vi");
    expect(result).toMatchObject({ passed: false, completed: false, attempt_group_id: "group" });
    expect(getLessonProgressForCourse).toHaveBeenCalledWith("user", "course");
  });
  it("keeps historical completion even when the latest attempt failed", async () => {
    vi.mocked(getLessonProgressForCourse).mockResolvedValue([{ id: "progress", user_id: "user", course_id: "course", lesson_id: "lesson", completed_at: "2026-09-10T00:00:00Z" }]);
    const { result } = await getLearningQuiz("course", "lesson", "user", "en");
    expect(result).toMatchObject({ passed: false, completed: true });
  });
  it("does not borrow completion from another lesson", async () => {
    vi.mocked(getLessonProgressForCourse).mockResolvedValue([{ id: "progress", user_id: "user", course_id: "course", lesson_id: "other", completed_at: "2026-09-10T00:00:00Z" }]);
    expect((await getLearningQuiz("course", "lesson", "user", "vi")).result?.completed).toBe(false);
  });
  it("does not read progress or attempts for public or preview content", async () => {
    expect((await getLearningQuiz("course", "lesson", undefined, "en")).result).toBeNull();
    expect(getLessonProgressForCourse).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it("surfaces progress read errors instead of inventing a completion state", async () => {
    vi.mocked(getLessonProgressForCourse).mockRejectedValue(new Error("Progress unavailable"));
    await expect(getLearningQuiz("course", "lesson", "user", "en")).rejects.toThrow("Progress unavailable");
  });
});


it("preserves structured transaction details for lesson authoring errors", async () => {
  const details = JSON.stringify({ issues: [{ lessonId: "lesson", field: "practice_config", code: "invalid_related_project" }] });
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "LESSON_NOT_PUBLISHABLE: invalid_related_project", details } } as never);
  await expect(saveLearningLesson("course", { id: "lesson" } as never)).rejects.toMatchObject({ message: "LESSON_NOT_PUBLISHABLE: invalid_related_project", details });
});

it("uses typed locale copy in the actual learner quiz loader", async () => {
  vi.mocked(getLessonQuestions).mockResolvedValue([{ id: "q", type: "mcq", question: "Original", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correct_index: 0 }] as never);
  vi.mocked(getCourseLessonLocaleContentMap).mockResolvedValue(new Map([["lesson", { question_copy: { q: { question: 42, options: { a: {} } } } }]]) as never);
  const result = await getLearningQuiz("course", "lesson", undefined, "en");
  expect(result.questions[0]).toMatchObject({ question: "Original", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] });
});
it("rejects malformed canonical questions before rendering or grading", async () => {
  vi.mocked(getLessonQuestions).mockResolvedValue([{ id: "q", type: "mcq", question: "Q", options: {}, correct_index: 0 }] as never);
  await expect(getLearningQuiz("course", "lesson", undefined, "vi")).rejects.toThrow("INVALID_QUESTIONS");
});
