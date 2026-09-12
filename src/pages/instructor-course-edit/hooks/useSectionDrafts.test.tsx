// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { useSectionDrafts } from "./useSectionDrafts";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("merges late locale responses without replacing typed fields and only saves edited locales", () => {
  let draft: ReturnType<typeof useSectionDrafts>;
  function Editor() { const value = useSectionDrafts(); useEffect(() => { draft = value; }, [value]); return null; }
  const root = createRoot(document.createElement("div"));
  try {
    act(() => root.render(<Editor />));
    let hydrate: ReturnType<typeof draft.begin>;
    act(() => { hydrate = draft.begin("en", { vi: { title: "VI", description: "base" }, en: { title: "VI", description: "base" } }); });
    act(() => draft.setTitle("English draft"));
    act(() => hydrate("en", { title: "Saved English", description: "English description" }));
    expect(draft!.value).toEqual({ title: "English draft", description: "English description" });
    act(() => draft.select("vi"));
    expect(draft!.dirty).toBe(true);
    expect(draft!.changed.map(([locale]) => locale)).toEqual(["en"]);
    act(() => draft.select("en"));
    const submitted = draft!.value;
    act(() => draft.setDescription("New edit during save"));
    act(() => draft.acknowledge("en", submitted));
    expect(draft!.dirty).toBe(true);
    expect(draft!.value.description).toBe("New edit during save");
  } finally { act(() => root.unmount()); }
});

it("ignores locale and generated text responses from a closed or replaced dialog", () => {
  let draft: ReturnType<typeof useSectionDrafts>;
  function Editor() { const value = useSectionDrafts(); useEffect(() => { draft = value; }, [value]); return null; }
  const root = createRoot(document.createElement("div"));
  try {
    act(() => root.render(<Editor />));
    let hydrate: ReturnType<typeof draft.begin>;
    act(() => { hydrate = draft.begin("vi", { vi: { title: "First", description: "" } }); });
    const lateTitle = draft!.setTitle;
    act(() => draft.close());
    act(() => draft.begin("vi", { vi: { title: "Second", description: "" } }));
    act(() => { hydrate("vi", { title: "Old response", description: "old" }); lateTitle("Old generated text"); });
    expect(draft!.value.title).toBe("Second");
    expect(draft!.dirty).toBe(false);
  } finally { act(() => root.unmount()); }
});

it("retains the failed locale when another locale save succeeds", () => {
  let draft: ReturnType<typeof useSectionDrafts>;
  function Editor() { const value = useSectionDrafts(); useEffect(() => { draft = value; }, [value]); return null; }
  const root = createRoot(document.createElement("div"));
  try {
    act(() => root.render(<Editor />));
    act(() => draft.begin("vi", { vi: { title: "VI", description: "" }, en: { title: "EN", description: "" } }));
    act(() => draft.setTitle("VI changed"));
    const submittedVi = draft!.value;
    act(() => draft.select("en"));
    act(() => draft.setTitle("EN changed"));
    act(() => draft.acknowledge("vi", submittedVi));
    expect(draft!.changed).toEqual([["en", { title: "EN changed", description: "" }]]);
    expect(draft!.dirty).toBe(true);
    expect(draft!.get("vi")?.title).toBe("VI changed");
  } finally { act(() => root.unmount()); }
});
