import { describe, expect, it } from "vitest";
import { groupResourcesBySection, resourceIconForUrl } from "./resourceGroups";

const section = (id: string) => ({ id, title: `Section ${id}` });

describe("groupResourcesBySection", () => {
  it("groups links by section in curriculum order", () => {
    const result = groupResourcesBySection([
      { section: section("a"), lessons: [{ resources: [{ title: "A1", url: "https://example.com/a1" }] }] },
      { section: section("b"), lessons: [{ resources: [{ title: "B1", url: "https://example.com/b1" }] }] },
    ]);
    expect(result.map(group => [group.id, group.items.map(item => item.title)])).toEqual([["a", ["A1"]], ["b", ["B1"]]]);
  });

  it("keeps a duplicate URL only in the first section that has it", () => {
    const shared = { title: "Shared", url: "https://example.com/shared" };
    const result = groupResourcesBySection([
      { section: section("a"), lessons: [{ resources: [shared] }] },
      { section: section("b"), lessons: [{ resources: [shared, { title: "B1", url: "https://example.com/b1" }] }] },
    ]);
    expect(result[0].items.map(item => item.title)).toEqual(["Shared"]);
    expect(result[1].items.map(item => item.title)).toEqual(["B1"]);
  });

  it("drops sections without links", () => {
    const result = groupResourcesBySection([
      { section: section("a"), lessons: [{ resources: [] }, { resources: undefined }] },
      { section: section("b"), lessons: [{ resources: [{ title: "B1", url: "https://example.com/b1" }] }] },
    ]);
    expect(result.map(group => group.id)).toEqual(["b"]);
  });

  it("filters unsafe links and infers the GitHub icon from the URL", () => {
    const result = groupResourcesBySection([
      {
        section: section("a"),
        lessons: [{ resources: [
          { title: "Unsafe", url: "javascript:alert(1)" },
          { title: "Repo", url: "https://github.com/corelia/repo" },
          { title: "Guide", url: "https://example.com/guide" },
        ] }],
      },
    ]);
    expect(result[0].items.map(item => [item.title, item.icon])).toEqual([["Repo", "github"], ["Guide", "link"]]);
  });
});

describe("resourceIconForUrl", () => {
  it("falls back to link for malformed URLs", () => {
    expect(resourceIconForUrl("not a url")).toBe("link");
    expect(resourceIconForUrl("https://www.github.com/x")).toBe("github");
  });
});
