import { describe, expect, it } from "vitest";
import { renderOgImage } from "./render.tsx";
import type { OgCard, OgEntity } from "./types.ts";

function card(entity: OgEntity): OgCard {
  return {
    entity, id: "one", canonicalId: "mau", title: "Khóa học Công nghệ Việt Nam",
    description: "Một bản xem trước ảnh chia sẻ với dấu tiếng Việt và nội dung dài có thể xuống dòng.",
    subtitle: "Corelia Academy", tags: ["Solana", "Trí tuệ nhân tạo"], imagePath: null,
    dateLabel: entity === "hackathon" ? "24/09/2026" : null,
    updatedAt: "2026-09-24T00:00:00Z", canonicalUrl: "http://localhost:5173/projects/mau", revision: "abc",
  };
}

describe("OG PNG renderer", () => {
  it.each(["project", "course", "hackathon", "profile"] as const)("renders %s at 1200×630", async entity => {
    const png = await renderOgImage(card(entity), null);
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(1200);
    expect(view.getUint32(20)).toBe(630);
  });

  it("renders long Vietnamese text with fallback media", async () => {
    const input = card("project");
    input.title = "Dự án học tập và xây dựng cộng đồng công nghệ Việt Nam ".repeat(3);
    input.description = "Nội dung dài có dấu tiếng Việt để kiểm tra bố cục khi thiếu logo. ".repeat(5);
    const png = await renderOgImage(input, null);
    expect(new DataView(png.buffer, png.byteOffset, png.byteLength).getUint32(16)).toBe(1200);
    expect(png.byteLength).toBeGreaterThan(10000);
  });
});
