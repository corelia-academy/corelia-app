// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { useCourseSettingsDraft } from "./useCourseSettingsDraft";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const empty = { slug: "", published: false, final_assignment_fields: [] as string[], thumbnail_url: "" };
const server = { slug: "rust", published: true, final_assignment_fields: ["github_url"], thumbnail_url: "old.png" };
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
function setup() {
  let draft: ReturnType<typeof useCourseSettingsDraft<typeof empty>>;
  function Editor({ scope }: { scope: string }) {
    const current = useCourseSettingsDraft(scope, empty);
    useEffect(() => { draft = current; }, [current]);
    return <span>{current.value.slug}</span>;
  }
  const root = createRoot(document.createElement("div"));
  const select = (scope: string) => act(() => root.render(<Editor scope={scope} />));
  cleanup = () => act(() => root.unmount());
  select("owner:course");
  return { select, get: () => draft! };
}

it("retains edited settings on refetch while accepting untouched fields", () => {
  const { get } = setup();
  act(() => get().hydrate(server));
  expect(get().dirty).toBe(false);
  act(() => get().setValue(previous => ({ ...previous, slug: "my-draft", final_assignment_fields: ["github_url", "notes"] })));
  act(() => get().hydrate({ ...server, thumbnail_url: "new.png" }));
  expect(get().value).toEqual({ ...server, thumbnail_url: "new.png", slug: "my-draft", final_assignment_fields: ["github_url", "notes"] });
  expect(get().dirty).toBe(true);
});

it("acknowledges only the submitted snapshot and clears dirty on a successful save or manual revert", () => {
  const { get } = setup();
  act(() => get().hydrate(server));
  act(() => get().setValue(previous => ({ ...previous, published: false })));
  const submitted = get().value;
  act(() => get().setValue(previous => ({ ...previous, slug: "newer-edit" })));
  act(() => get().acknowledge(submitted));
  act(() => get().hydrate(submitted));
  expect(get().value.slug).toBe("newer-edit");
  expect(get().dirty).toBe(true);
  act(() => get().setValue(submitted));
  expect(get().dirty).toBe(false);
});

it("scopes late hydration to its course and fills untouched fields after early input", () => {
  const { get, select } = setup();
  const hydrateOriginal = get().hydrate;
  act(() => get().setValue(previous => ({ ...previous, slug: "early" })));
  select("other-owner:other-course");
  act(() => hydrateOriginal(server));
  expect(get().value).toEqual(empty);
  expect(get().dirty).toBe(false);
  select("owner:course");
  expect(get().value).toEqual({ ...server, slug: "early" });
});
