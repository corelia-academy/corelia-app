import { describe, expect, it } from "vitest";
import pilot from "../../../docs/learning/pilot/course.json";
import { validateCodeConfig } from "./config";

describe("bilingual Rust pilot contract", () => {
  it("keeps twelve stable lesson identities in two sections", () => {
    expect(pilot.sections).toHaveLength(2);
    expect(pilot.lessons).toHaveLength(12);
    expect(new Set(pilot.lessons.map(row => row.lesson.id)).size).toBe(12);
    for (const row of pilot.lessons) {
      expect(row.locales.vi.title).toBeTruthy();
      expect(row.locales.en.title).toBeTruthy();
      expect(pilot.sections.some(section => section.id === row.lesson.section_id)).toBe(true);
    }
    expect(pilot.course.data.has_certificate).toBe(false);
  });
  it("publishes valid reference solutions for two fill and two edit exercises", () => {
    const configs = pilot.lessons.flatMap(row => "code_exercise_config" in row.lesson ? [row.lesson.code_exercise_config] : []);
    expect(configs).toHaveLength(4);
    expect(configs.filter(config => config?.mode === "fill")).toHaveLength(2);
    for (const config of configs) expect(validateCodeConfig(config, true)).toEqual([]);
  });
});
