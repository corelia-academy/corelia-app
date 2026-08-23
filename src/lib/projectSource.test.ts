import { describe, expect, it } from "vitest";

import { isHackathonProjectSource, projectSourceLabelKey } from "./projectSource";

describe("hackathon project-source compatibility", () => {
  it.each(["contest", "hackathon"] as const)("treats %s as hackathon provenance", (sourceType) => {
    expect(isHackathonProjectSource(sourceType)).toBe(true);
    expect(projectSourceLabelKey(sourceType)).toBe("projects.sourceHackathon");
  });

  it("does not classify standalone or course projects as hackathon provenance", () => {
    expect(isHackathonProjectSource("standalone")).toBe(false);
    expect(isHackathonProjectSource("course")).toBe(false);
  });
});
