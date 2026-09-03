import { describe, expect, it } from "vitest";
import type { Profile, UserRole } from "../types/database";
import {
  canAccessContestManagementCatalog,
  canManageContests,
} from "./permissions";

function profileWithRole(role: UserRole): Profile {
  return { role } as Profile;
}

describe("hackathon manager permissions", () => {
  it.each(["support_staff", "admin"] satisfies UserRole[])(
    "allows %s to manage hackathons end-to-end",
    (role) => {
      const profile = profileWithRole(role);

      expect(canManageContests(profile)).toBe(true);
      expect(canAccessContestManagementCatalog(profile)).toBe(true);
    },
  );

  it("keeps instructors outside hackathon administration", () => {
    const profile = profileWithRole("instructor");

    expect(canManageContests(profile)).toBe(false);
    expect(canAccessContestManagementCatalog(profile)).toBe(false);
  });

  it("does not grant full manager access to students", () => {
    const profile = profileWithRole("student");

    expect(canManageContests(profile)).toBe(false);
    expect(canAccessContestManagementCatalog(profile)).toBe(false);
  });
});
