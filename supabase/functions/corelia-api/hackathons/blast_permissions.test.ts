import { describe, expect, it } from "vitest";
import { canProfileBlastHackathonEmail } from "./blast_permissions";

describe("canProfileBlastHackathonEmail", () => {
  const hackathon = {
    co_organizer_emails: ["cohost@example.com"],
    reviewer_emails: ["reviewer@example.com"],
  };

  it("allows platform managers", () => {
    expect(
      canProfileBlastHackathonEmail(
        { role: "admin", email: "admin@example.com" },
        hackathon,
      ),
    ).toBe(true);
    expect(
      canProfileBlastHackathonEmail(
        { role: "support_staff", email: "support@example.com" },
        hackathon,
      ),
    ).toBe(true);
  });

  it("does not allow co-organizers after simplified scope", () => {
    expect(
      canProfileBlastHackathonEmail(
        { role: "student", email: "  CoHost@Example.com " },
        hackathon,
      ),
    ).toBe(false);
  });

  it("does not allow application reviewers", () => {
    expect(
      canProfileBlastHackathonEmail(
        { role: "student", email: "reviewer@example.com" },
        hackathon,
      ),
    ).toBe(false);
  });

  it("does not allow unrelated users", () => {
    expect(
      canProfileBlastHackathonEmail(
        { role: "student", email: "learner@example.com" },
        hackathon,
      ),
    ).toBe(false);
  });
});
