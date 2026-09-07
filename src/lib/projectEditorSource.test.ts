import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  media: [] as Array<{ path: string; signedUrl: string }>,
  project: { id: "33333333-3333-4333-8333-333333333333", owner_id: null, title: "Original title", summary: "Original summary", logo_path: null, screenshot_paths: ["first", "second"], i18n: { en: { title: "Translated title" } } },
}));
vi.mock("@/lib/supabase", () => ({ supabase: {
  from: () => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.project, error: null }) };
    return chain;
  },
  storage: { from: () => ({ createSignedUrls: async () => ({ data: state.media, error: null }) }) },
} }));
vi.mock("@/i18n", () => ({ default: { language: "en", resolvedLanguage: "en" } }));

import { getProjectBySlugOrId } from "./projects";

beforeEach(() => { state.media = [{ path: "first", signedUrl: "https://example.com/first" }, { path: "second", signedUrl: "https://example.com/second" }]; });

it("loads source text and keeps screenshot URLs paired with their paths for editing", async () => {
  const result = await getProjectBySlugOrId(state.project.id, "en", true);
  expect(result?.project.title).toBe("Original title");
  expect(result?.project.screenshot_urls).toEqual(state.media.map(item => item.signedUrl));
});

it("fails closed when an earlier screenshot is unavailable instead of shifting later URLs", async () => {
  state.media.shift();
  await expect(getProjectBySlugOrId(state.project.id, "en", true)).rejects.toThrow("project_media_unavailable");
});
