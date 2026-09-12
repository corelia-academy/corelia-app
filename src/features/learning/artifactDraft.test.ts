// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { normalizeArtifactDraft, readArtifactDraft } from "./artifactDraft";

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it.each([null, [], false, "notes", { notes: null, github_url: 42 }])("rejects malformed artifact draft %j", value => {
  expect(normalizeArtifactDraft(value)).toEqual({});
});

it("retains only supported string fields for final submission", () => {
  expect(normalizeArtifactDraft({ notes: "My work", github_url: "https://github.com/example/repo", source: "private source", demo_url: [] }))
    .toEqual({ notes: "My work", github_url: "https://github.com/example/repo" });
});

it("restores final artifacts and tolerates corrupt JSON", () => {
  localStorage.setItem("draft", JSON.stringify({ notes: "Saved work" }));
  expect(readArtifactDraft("draft")).toEqual({ notes: "Saved work" });
  localStorage.setItem("draft", "{broken");
  expect(readArtifactDraft("draft")).toEqual({});
});

it("tolerates storage access failure", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new DOMException("denied"); } });
  expect(readArtifactDraft("draft")).toEqual({});
});
