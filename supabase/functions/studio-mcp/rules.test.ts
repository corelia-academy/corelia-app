import { describe, expect, it } from "vitest";

import { droppedTranslationLocales, requireResearchVideos, RESEARCH_VIDEO_INSTRUCTIONS } from "./rules.ts";

const video = { topic: "gas", url: "https://www.youtube.com/watch?v=0R8jSGLw5zk", rank: 1 };

describe("requireResearchVideos", () => {
  it("keeps an accepted research that has a valid video", () => {
    const accepted = { ok: true as const, summary: "1 chủ đề." };
    expect(requireResearchVideos(accepted, { videos: [video] })).toBe(accepted);
  });

  it("rejects an accepted research with no videos and tells the coordinator how to find them", () => {
    const result = requireResearchVideos({ ok: true, summary: "1 chủ đề." }, { videos: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("chưa có video ứng viên hợp lệ");
      expect(result.reason).toContain("1 chủ đề.");
      expect(result.reason).toContain(RESEARCH_VIDEO_INSTRUCTIONS);
    }
  });

  it("rejects a research whose videos field is missing or not a list", () => {
    expect(requireResearchVideos({ ok: true, summary: "s" }, {}).ok).toBe(false);
    expect(requireResearchVideos({ ok: true, summary: "s" }, { videos: "x" }).ok).toBe(false);
    expect(requireResearchVideos({ ok: true, summary: "s" }, null).ok).toBe(false);
  });

  it("judges the normalized output when invalid videos were dropped", () => {
    const dropped = { ok: true as const, summary: "s", normalizedOutput: { videos: [] } };
    expect(requireResearchVideos(dropped, { videos: [video] }).ok).toBe(false);
    const kept = { ok: true as const, summary: "s", normalizedOutput: { videos: [video] } };
    expect(requireResearchVideos(kept, { videos: [] })).toBe(kept);
  });

  it("passes an already rejected research through unchanged", () => {
    const rejected = { ok: false as const, reason: "Research chưa đạt" };
    expect(requireResearchVideos(rejected, { videos: [] })).toBe(rejected);
  });
});

describe("droppedTranslationLocales", () => {
  it("lists locales with generations that the run no longer targets, once each", () => {
    expect(droppedTranslationLocales(["vi", "ja", "ja", "ko"], ["vi"])).toEqual(["ja", "ko"]);
  });

  it("is empty when every used locale stays chosen or none were used", () => {
    expect(droppedTranslationLocales(["vi"], ["vi", "ja"])).toEqual([]);
    expect(droppedTranslationLocales([], ["vi"])).toEqual([]);
  });
});
