import { describe, expect, it } from "vitest";

import { hasUnchangedSourceInput } from "./pipeline.ts";

describe("jobs pipeline change detection", () => {
  it("reprocesses unchanged raw payloads when normalized adapter output changes", () => {
    const existing = { payload_hash: "same-raw", input_hash: "old-normalized", classifier_version: "jobs-ai-3" };
    expect(hasUnchangedSourceInput(existing, "same-raw", "new-normalized", "jobs-ai-3")).toBe(false);
    expect(hasUnchangedSourceInput(existing, "same-raw", "old-normalized", "jobs-ai-3")).toBe(true);
  });

  it("reprocesses unchanged input when the classifier contract changes", () => {
    const existing = { payload_hash: "same-raw", input_hash: "same-normalized", classifier_version: "jobs-ai-2" };
    expect(hasUnchangedSourceInput(existing, "same-raw", "same-normalized", "jobs-ai-3")).toBe(false);
  });
});
