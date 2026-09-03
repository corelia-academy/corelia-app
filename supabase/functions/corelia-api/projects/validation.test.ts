import { describe, expect, it } from "vitest";
import {
  detectImageMime,
  isOwnedProjectMediaPath,
  normalizeHttpsUrl,
  validateProjectLinks,
} from "./validation.ts";

describe("project validation", () => {
  it("accepts a canonical GitHub repository", () => {
    expect(validateProjectLinks({ repo_url: "https://github.com/corelia/app" })[0]).toMatchObject({
      field: "repo_url",
    });
  });

  it("rejects non-repository GitHub and local URLs", () => {
    expect(() => validateProjectLinks({ repo_url: "https://github.com/corelia/app/issues" })).toThrow("invalid_url:repo_url");
    expect(() => normalizeHttpsUrl("demo_url", "https://127.0.0.1/demo")).toThrow("invalid_url:demo_url");
    expect(() => normalizeHttpsUrl("demo_url", "http://example.com")).toThrow("invalid_url:demo_url");
  });

  it("rejects private IPv6 without rejecting ordinary domains with similar prefixes", () => {
    expect(normalizeHttpsUrl("demo_url", "https://fcdomain.example/demo")).toBe("https://fcdomain.example/demo");
    expect(normalizeHttpsUrl("demo_url", "https://fdesign.example/demo")).toBe("https://fdesign.example/demo");
    expect(() => normalizeHttpsUrl("demo_url", "https://[::1]/demo")).toThrow("invalid_url:demo_url");
    expect(() => normalizeHttpsUrl("demo_url", "https://[fd00::1]/demo")).toThrow("invalid_url:demo_url");
    expect(() => normalizeHttpsUrl("demo_url", "https://[fe80::1]/demo")).toThrow("invalid_url:demo_url");
  });

  it("does not include video_url in the AI link-check input", () => {
    const values = { video_url: "https://example.com/demo.mp4" } as Parameters<typeof validateProjectLinks>[0];
    expect(validateProjectLinks(values)).toEqual([]);
  });

  it("detects supported image signatures", () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("scopes media paths to owner and project", () => {
    const path = "project-media/user-1/project-1/logo/file.png";
    expect(isOwnedProjectMediaPath(path, "user-1", "project-1")).toBe(true);
    expect(isOwnedProjectMediaPath(path, "user-2", "project-1")).toBe(false);
  });
});
