import { describe, expect, it } from "vitest";

import { detectAtsFromCareersUrl } from "./atsDetection";

describe("detectAtsFromCareersUrl", () => {
  it.each([
    ["https://job-boards.greenhouse.io/acme/jobs/123", "greenhouse", "acme", "global"],
    ["https://jobs.lever.co/acme/123", "lever", "acme", "global"],
    ["https://jobs.eu.lever.co/acme", "lever", "acme", "eu"],
    ["https://api.lever.co/v0/postings/acme?mode=json", "lever", "acme", "global"],
    ["https://jobs.ashbyhq.com/acme", "ashby", "acme", "global"],
    ["https://careers.smartrecruiters.com/Acme", "smartrecruiters", "Acme", "global"],
  ])("detects %s", (url, sourceType, sourceIdentifier, sourceRegion) => {
    expect(detectAtsFromCareersUrl(url)).toEqual({ sourceType, sourceIdentifier, sourceRegion });
  });

  it("returns null for an unsupported or malformed URL", () => {
    expect(detectAtsFromCareersUrl("https://example.com/careers")).toBeNull();
    expect(detectAtsFromCareersUrl("not a url")).toBeNull();
  });
});
