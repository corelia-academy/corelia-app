// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { useLearnSubmission } from "./useLearnSubmission";
import { submitFinalAssignment } from "@/lib/finalAssignment";
import type { FinalAssignmentSubmission } from "@/types/courses";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/features/courses/courseQueries", () => ({
  courseKeys: { submission: (user: string, course: string) => ["submission", user, course] },
  courseSubmissionQueryOptions: (user: string, course: string) => ({ queryKey: ["submission", user, course], queryFn: async () => null, staleTime: Infinity }),
}));
vi.mock("@/lib/finalAssignment", () => ({ getSubmission: vi.fn(), submitFinalAssignment: vi.fn() }));
vi.mock("@/features/learning/invalidateLearningProgress", () => ({ invalidateLearningProgress: vi.fn() }));
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); vi.clearAllMocks(); });

it.each([["learner", "course-b"], ["other-learner", "course-a"]])("keeps a late submission in its original cache after switching to %s/%s", async (nextUser, nextCourse) => {
  const client = new QueryClient();
  const root = createRoot(document.createElement("div"));
  cleanup = () => { act(() => root.unmount()); client.clear(); };
  let current!: ReturnType<typeof useLearnSubmission>;
  function Consumer({ user, course }: { user: string; course: string }) {
    const value = useLearnSubmission({ profileId: user, courseId: course });
    useEffect(() => { current = value; }, [value]);
    return <p>{value.submission?.id}</p>;
  }
  const render = (user: string, course: string) => act(() => root.render(<QueryClientProvider client={client}><Consumer user={user} course={course} /></QueryClientProvider>));
  const originalKey = ["submission", "learner", "course-a"];
  const nextKey = ["submission", nextUser, nextCourse];
  client.setQueryData(originalKey, null);
  const nextRow = { id: "next-private-row", user_id: nextUser, course_id: nextCourse, status: "pending" };
  client.setQueryData(nextKey, nextRow);
  let resolve!: (row: FinalAssignmentSubmission) => void;
  vi.mocked(submitFinalAssignment).mockReturnValue(new Promise(done => { resolve = done; }));
  render("learner", "course-a");
  let pending!: Promise<FinalAssignmentSubmission>;
  await act(async () => { pending = current.submit({ content: "Original private submission" }); });
  render(nextUser, nextCourse);
  const originalRow = { id: "original-row", user_id: "learner", course_id: "course-a", status: "pending" } as FinalAssignmentSubmission;
  await act(async () => { resolve(originalRow); await pending; });
  expect(client.getQueryData(nextKey)).toEqual(nextRow);
  expect(client.getQueryData(originalKey)).toEqual(originalRow);
});
