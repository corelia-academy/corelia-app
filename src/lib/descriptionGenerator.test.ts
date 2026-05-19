import { describe, expect, it } from "vitest";

import { normalizeYoutubeVideoId } from "./youtubeVideoId";

describe("normalizeYoutubeVideoId", () => {
  it("accepts a raw video id", () => {
    expect(normalizeYoutubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from watch URLs", () => {
    expect(normalizeYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts from youtu.be URLs", () => {
    expect(normalizeYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for invalid input", () => {
    expect(normalizeYoutubeVideoId("not-a-youtube-link")).toBeNull();
  });
});
