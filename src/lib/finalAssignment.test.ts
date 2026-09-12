import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinalAssignmentSubmission } from "@/types/courses";

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/lib/courses", () => ({ syncCourseCompletion: vi.fn() }));
import { latestSubmissionsByUser, updateSubmissionStatus } from "./finalAssignment";
import { supabase } from "@/lib/supabase";
import { syncCourseCompletion } from "@/lib/courses";
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

function submission(id: string, submitted_at: string, status: FinalAssignmentSubmission["status"], user_id = "learner"): FinalAssignmentSubmission {
  return { id, submitted_at, status, user_id, course_id: "course", content: "Project", file_urls: [], reviewer_comment: null, reviewed_at: null };
}

describe("latest final submission", () => {
  it("keeps a resubmission over a previous rejected attempt regardless of input order", () => {
    const rejected = submission("old", "2026-09-10T10:00:00Z", "rejected");
    const pending = submission("new", "2026-09-11T10:00:00Z", "pending");
    for (const rows of [[pending, rejected], [rejected, pending]]) {
      expect(latestSubmissionsByUser(rows).learner).toBe(pending);
    }
  });
  it("uses the stable ID tie-break and isolates learners", () => {
    const olderId = submission("a", "2026-09-11T10:00:00Z", "rejected");
    const newerId = submission("b", "2026-09-11T10:00:00Z", "pending");
    const other = submission("c", "2026-09-09T10:00:00Z", "approved", "other");
    expect(latestSubmissionsByUser([newerId, other, olderId])).toEqual({ learner: newerId, other });
  });
});

it("returns server review metadata and keeps a committed approval successful when credential sync fails", async () => {
  const reviewed = { ...submission("reviewed", "2026-01-01", "approved"), reviewer_comment: "Server comment", reviewed_at: "2026-02-01", artifacts: { github_url: "https://github.com/example/project" } };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: reviewed, error: null } as never);
  vi.mocked(syncCourseCompletion).mockRejectedValue(new Error("Credential sync unavailable"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(updateSubmissionStatus("reviewed", "approved", "Comment")).resolves.toEqual(reviewed);
  expect(supabase.rpc).toHaveBeenCalledWith("learning_final_review", { p_submission: "reviewed", p_status: "approved", p_comment: "Comment" });
  expect(syncCourseCompletion).toHaveBeenCalledWith("learner", "course");
});

it("rejects stale review responses without scheduling credential work", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: { message: "STALE_SUBMISSION" } } as never);
  await expect(updateSubmissionStatus("old", "approved")).rejects.toThrow("STALE_SUBMISSION");
  expect(syncCourseCompletion).not.toHaveBeenCalled();
});

it("does not report a successful review when the server returns no persisted row", async () => {
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
  await expect(updateSubmissionStatus("missing", "approved")).rejects.toThrow("INVALID_SUBMISSION_RESPONSE");
  expect(syncCourseCompletion).not.toHaveBeenCalled();
});

it("keeps unavailable placeholders for malformed legacy attachments without rewriting stored data", async () => {
  const raw = { ...submission("legacy", "2026-01-01", "rejected"), file_urls: [{ bad: "file" }, "https://example.com/good"] };
  vi.mocked(supabase.rpc).mockResolvedValue({ data: raw, error: null } as never);
  await expect(updateSubmissionStatus("legacy", "rejected")).resolves.toMatchObject({ file_urls: ["", "https://example.com/good"] });
  expect(raw.file_urls[0]).toEqual({ bad: "file" });
});
