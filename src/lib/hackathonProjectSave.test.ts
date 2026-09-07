import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  submission: null as Record<string, unknown> | null,
  lookupError: false,
  save: vi.fn(),
}));
vi.mock("@/i18n", () => ({ default: { language: "en", resolvedLanguage: "en" } }));
vi.mock("@/lib/projectSubmission", () => ({ saveProject: mocks.save }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  from: (table: string) => {
    const data = table === "hackathons" ? { id: "event", status: "published", document: { title: "Event", submission_deadline: "2099-01-01", tracks: [] } }
      : table === "hackathon_registrations" ? { id: "event_owner", hackathon_id: "event", user_id: "owner", document: { status: "approved" } }
      : table === "hackathon_submissions" ? mocks.submission : null;
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data, error: table === "hackathon_submissions" && mocks.lookupError ? { message: "connection failed" } : null }) };
    return chain;
  },
} }));
import { getMyContestSubmission, upsertContestSubmission } from "./hackathons";
const input = { project_id: "new-project", title: "New title", slug: "new-title", summary: "", track_ids: ["track"], sector_ids: ["area"], tech_stack_ids: ["tech"] };

describe("hackathon project save identity", () => {
  beforeEach(() => {
    mocks.lookupError = false;
    mocks.submission = { id: "event_owner", hackathon_id: "event", user_id: "owner", project_id: "original-project", document: { title: "Original", summary: "Keep this" } };
    mocks.save.mockReset();
  });
  it("rejects a new form ID instead of overwriting the owner's existing submission", async () => {
    await expect(upsertContestSubmission("event", input)).rejects.toThrow("conflict:project_already_exists");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.submission?.document).toEqual({ title: "Original", summary: "Keep this" });
  });
  it("allows an explicit edit of the existing project", async () => {
    await upsertContestSubmission("event", { ...input, project_id: "original-project" });
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ project_id: "original-project", title: "New title" }));
  });
  it("fails closed when the submission lookup fails", async () => {
    mocks.lookupError = true;
    await expect(getMyContestSubmission("event")).rejects.toThrow("connection failed");
    await expect(upsertContestSubmission("event", input)).rejects.toThrow("connection failed");
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
