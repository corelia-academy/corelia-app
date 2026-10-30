import { describe, expect, it } from "vitest";
import { PROMPT_VERSIONS, type PromptKey } from "./prompts.ts";
import { SEEDED_PROMPTS } from "./prompt_seed_test_helper.ts";

describe("Studio prompt seeds", () => {
  it("pins every immutable database seed by key, role, and numeric version", () => {
    const expected: Record<PromptKey, string> = {
      "a1-catalog-research": "A1",
      "a2-brief": "A2",
      "a2-research": "A2",
      "a3-curriculum": "A3",
      "a4-curriculum-review": "A4",
      "a5-lesson": "A5",
      "a6-lesson-review": "A6",
    };
    expect(Object.keys(SEEDED_PROMPTS).sort()).toEqual(Object.keys(PROMPT_VERSIONS).sort());
    for (const key of Object.keys(PROMPT_VERSIONS) as PromptKey[]) {
      expect(SEEDED_PROMPTS[key]!.role).toBe(expected[key]);
      expect(Number(SEEDED_PROMPTS[key]!.version.slice(1))).toBe(PROMPT_VERSIONS[key]);
      expect(SEEDED_PROMPTS[key]!.system.trim()).not.toBe("");
      expect(SEEDED_PROMPTS[key]!.system).not.toMatch(/^[\r\n]|[\r\n]$/);
    }
  });
});
