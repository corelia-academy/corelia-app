import { describe, expect, it } from "vitest";
import { contentRevision, dateLabel, plainText, safeId } from "./text.ts";

describe("OG display normalization", () => {
  it("strips markup, control characters and caps long text", () => {
    expect(plainText("<b>Xin chào</b>\n**Việt Nam**", 80)).toBe("Xin chào Việt Nam");
    expect(Array.from(plainText("đ".repeat(200), 96) ?? "")).toHaveLength(96);
    expect(safeId("../private")).toBeNull();
  });

  it("formats event dates in Vietnam time", () => {
    expect(dateLabel("2026-09-23T18:30:00Z")).toBe("24/09/2026");
  });

  it("changes revision only when the supplied display data changes", async () => {
    const a = await contentRevision(["Khóa học", "Mô tả", null]);
    expect(await contentRevision(["Khóa học", "Mô tả", null])).toBe(a);
    expect(await contentRevision(["Khóa học mới", "Mô tả", null])).not.toBe(a);
  });
});
