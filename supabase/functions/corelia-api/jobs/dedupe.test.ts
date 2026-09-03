import { describe, expect, it } from "vitest";

import { canonicalSourceScore, shouldReplaceCanonical } from "./dedupe.ts";

describe("jobs canonical source precedence", () => {
  it("always prefers an official employer ATS over a syndicated feed", () => {
    expect(shouldReplaceCanonical(
      { source_type: "web3career", priority: 100 },
      { source_type: "smartrecruiters", priority: 1 },
    )).toBe(true);
    expect(shouldReplaceCanonical(
      { source_type: "ashby", priority: 1 },
      { source_type: "web3career", priority: 100 },
    )).toBe(false);
  });

  it("uses configured priority only within the same source class", () => {
    expect(shouldReplaceCanonical(
      { source_type: "remotive", priority: 50 },
      { source_type: "web3career", priority: 90 },
    )).toBe(true);
    expect(canonicalSourceScore({ source_type: "rss", priority: 100 }))
      .toBeLessThan(canonicalSourceScore({ source_type: "remoteok", priority: 0 }));
  });

  it("keeps the existing canonical source on an exact tie", () => {
    expect(shouldReplaceCanonical(
      { source_type: "greenhouse", priority: 100 },
      { source_type: "greenhouse", priority: 100 },
    )).toBe(false);
  });
});
