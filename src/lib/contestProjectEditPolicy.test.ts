import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/coreliaEdgeApi", () => ({ invokeCoreliaApi: vi.fn() }));
import { canEditContestProject, canRegisterForContest, isPastContestSubmissionDeadline } from "./hackathons";

const deadline = "2026-10-08T12:00:00Z";
const contest = { status: "published" as const, submission_deadline: deadline, ends_at: null };
afterEach(() => vi.useRealTimers());
describe("shared submission deadline and project reopening", () => {
  it.each([-1, 0, 1])("uses the same boundary for registration and editing (%d ms)", offset => {
    vi.useFakeTimers().setSystemTime(Date.parse(deadline) + offset);
    expect(canRegisterForContest(contest)).toBe(offset <= 0);
    expect(canEditContestProject(contest)).toBe(offset <= 0);
    expect(isPastContestSubmissionDeadline(contest)).toBe(offset > 0);
  });
  it.each([[false,false,false],[true,false,true],[false,true,true],[true,true,true]])(
    "reopens only existing projects: announced=%s early=%s", (announced, early, expected) => {
      vi.useFakeTimers().setSystemTime(Date.parse(deadline) + 1);
      const value = { ...contest, winners_announced: announced, allow_project_edits_after_deadline: early };
      expect(canEditContestProject(value)).toBe(expected);
      expect(canRegisterForContest(value)).toBe(false);
    },
  );
  it("falls back to event end and stays open without either deadline", () => {
    vi.useFakeTimers().setSystemTime(Date.parse(deadline) + 1);
    expect(canEditContestProject({ submission_deadline: null, ends_at: deadline })).toBe(false);
    expect(canEditContestProject({ submission_deadline: null, ends_at: null })).toBe(true);
  });
  it("relocks when announcement and early-edit switches are both off", () => {
    vi.useFakeTimers().setSystemTime(Date.parse(deadline) + 1);
    expect(canEditContestProject({ ...contest, winners_announced: true })).toBe(true);
    expect(canEditContestProject({ ...contest, winners_announced: false })).toBe(false);
  });
});
