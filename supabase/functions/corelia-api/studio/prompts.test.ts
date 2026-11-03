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
      "a7-translate": "A7",
      "a8-video-segment": "A8",
    };
    expect(Object.keys(SEEDED_PROMPTS).sort()).toEqual(Object.keys(PROMPT_VERSIONS).sort());
    for (const key of Object.keys(PROMPT_VERSIONS) as PromptKey[]) {
      expect(SEEDED_PROMPTS[key]!.role).toBe(expected[key]);
      expect(Number(SEEDED_PROMPTS[key]!.version.slice(1))).toBe(PROMPT_VERSIONS[key]);
      expect(SEEDED_PROMPTS[key]!.system.trim()).not.toBe("");
      expect(SEEDED_PROMPTS[key]!.system).not.toMatch(/^[\r\n]|[\r\n]$/);
    }
  });

  it("keeps A3, A4, A5, and A6 aligned on the embedded opening-situation contract", () => {
    const sharedContract = "OPENING-SITUATION CONTRACT (new curricula): Do not create a separate warm_up lesson. The first teaching lesson in each module opens with one familiar, concrete situation or problem; it may pose one simple, unscored question or prediction. Do not require or wait for a learner response. Teach the new knowledge in that same lesson and explicitly resolve the opening situation before it ends. Do not add a score, pass threshold, retry, or required prior knowledge. quick_check reviews knowledge taught in the course; from module two onward it may revisit the previous module. A role-specific LEGACY instruction below applies only to finishing an already accepted older run; it never permits warm_up in a new curriculum.";
    const a3 = SEEDED_PROMPTS["a3-curriculum"].system;
    const a4 = SEEDED_PROMPTS["a4-curriculum-review"].system;
    const a5 = SEEDED_PROMPTS["a5-lesson"].system;
    const a6 = SEEDED_PROMPTS["a6-lesson-review"].system;

    for (const prompt of [a3, a4, a5, a6]) expect(prompt).toContain(sharedContract);
    expect(a3).toContain("Không tạo purpose warm_up");
    expect(a3).toContain("bài đầu tiên là bài Dạy");
    expect(a5).toContain("module.first_teaching_lesson_id");
    expect(a5).toContain("giải quyết rõ chính tình huống đó trước khi kết thúc phần nội dung");
    expect(a6).toContain("module.first_teaching_lesson_id");
    expect(a6).toContain("giải quyết rõ chính tình huống đó trước khi kết thúc");
    expect(a6).not.toContain("Quiz bước Thử (warm_up) hỏi kiến thức chưa được dạy trong khóa tính đến bài đó");
    expect(a3).toContain("Từ module thứ hai, có ít nhất một câu nhắc kiến thức module trước qua review_lesson_ids");
  });
});
