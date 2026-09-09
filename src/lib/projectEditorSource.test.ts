import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  media: [] as Array<{ path: string; signedUrl: string }>,
  project: { id: "33333333-3333-4333-8333-333333333333", owner_id: null, title: "Original title", summary: "Original summary", logo_path: null, screenshot_paths: ["first", "second"], i18n: { en: { title: "Translated title" } } },
}));
vi.mock("@/lib/supabase", () => ({ supabase: {
  from: (table: string) => {
    if (table === "project_locales") return { select: () => ({ eq: async () => ({ data: [{locale:"en",data:{title:"English title",description:"English story"}}], error:null }) }) };
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: state.project, error: null }) };
    return chain;
  },
  storage: { from: () => ({ createSignedUrls: async () => ({ data: state.media, error: null }) }) },
} }));
vi.mock("@/i18n", () => ({ default: { language: "en", resolvedLanguage: "en" } }));

import { applyProjectLocaleContent, getProjectBySlugOrId } from "./projects";

beforeEach(() => { state.media = [{ path: "first", signedUrl: "https://example.com/first" }, { path: "second", signedUrl: "https://example.com/second" }]; });

it("loads source text and keeps screenshot URLs paired with their paths for editing", async () => {
  const result = await getProjectBySlugOrId(state.project.id, "en", true);
  expect(result?.project.title).toBe("Original title");
  expect(result?.project.content_locales?.en?.description).toBe("English story");
  expect(result?.project.screenshot_urls).toEqual(state.media.map(item => item.signedUrl));
});

it("fails closed when an earlier screenshot is unavailable instead of shifting later URLs", async () => {
  state.media.shift();
  await expect(getProjectBySlugOrId(state.project.id, "en", true)).rejects.toThrow("project_media_unavailable");
});

it("localizes the whole story and falls back per empty field", () => {
  const source = { ...state.project, description: "Primary story", progress: "Primary progress" } as unknown as import("@/types/projects").Project;
  expect(applyProjectLocaleContent(source, {title:"English title",summary:" ",description:"English story",progress:null})).toMatchObject({title:"English title",summary:"Original summary",description:"English story",progress:"Primary progress"});
});
