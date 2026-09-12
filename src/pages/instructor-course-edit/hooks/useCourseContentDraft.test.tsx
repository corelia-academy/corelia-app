// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { useCourseContentDraft } from "./useCourseContentDraft";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
function setup() {
  let draft: ReturnType<typeof useCourseContentDraft>;
  function Editor({ selection }: { selection: string }) {
    const current = useCourseContentDraft(selection);
    useEffect(() => { draft = current; }, [current]);
    return <span>{current.contentForm.title}</span>;
  }
  const host = document.createElement("div"); const root = createRoot(host);
  const select = (selection: string) => act(() => root.render(<Editor selection={selection} />));
  cleanup = () => act(() => root.unmount());
  select("owner:course:vi");
  return { select, get: () => draft! };
}
const content = (title: string) => ({ title, description: "Body", short_description: "Summary", learning_outcomes: ["Outcome"], final_assignment_title: "Project", final_assignment_description: "Requirements", final_assignment_instructions: "Instructions" });

it("retains unsaved course and final-assignment copy when switching between locales", () => {
  const { select, get } = setup();
  act(() => get().hydrateContentForm(content("VI server")));
  act(() => get().setContentForm(previous => ({ ...previous, title: "VI draft", final_assignment_instructions: "VI instructions draft" })));
  select("owner:course:en");
  expect(get().contentForm.title).toBe("");
  act(() => get().hydrateContentForm(content("EN server")));
  act(() => get().setContentForm(previous => ({ ...previous, title: "EN draft" })));
  select("owner:course:vi");
  act(() => get().hydrateContentForm(content("VI refetch")));
  expect(get().contentForm).toEqual({ ...content("VI draft"), final_assignment_instructions: "VI instructions draft" });
  select("owner:course:en");
  expect(get().contentForm.title).toBe("EN draft");
});

it("isolates course/account keys and late callbacks, without overwriting existing edits", () => {
  const { select, get } = setup();
  const hydrateVi = get().hydrateContentForm;
  act(() => get().setContentForm(previous => ({ ...previous, title: "Early edit" })));
  select("owner:other-course:vi");
  act(() => { hydrateVi(content("Late response")); get().hydrateContentForm(content("Other course")); });
  expect(get().contentForm.title).toBe("Other course");
  select("different-owner:course:vi");
  expect(get().contentForm.title).toBe("");
  select("owner:course:vi");
  expect(get().contentForm.title).toBe("Early edit");
});

it("keeps the course dirty for a hidden locale until that locale is saved", () => {
  const { select, get } = setup();
  act(() => get().hydrateContentForm(content("VI server")));
  expect(get().contentDirty).toBe(false);
  act(() => get().setContentForm(content("VI draft")));
  const saveVi = get().markContentSaved;
  const submittedVi = get().contentForm;
  select("owner:course:en");
  act(() => get().hydrateContentForm(content("EN server")));
  expect(get().contentDirty).toBe(true);
  act(() => get().markContentSaved(get().contentForm));
  expect(get().contentDirty).toBe(true);
  act(() => saveVi(submittedVi));
  expect(get().contentDirty).toBe(false);
});

it("does not clear newer edits when an earlier save resolves", () => {
  const { get } = setup();
  act(() => get().hydrateContentForm(content("Server")));
  act(() => get().setContentForm(content("First edit")));
  const submitted = get().contentForm;
  act(() => get().setContentForm(content("Second edit")));
  act(() => get().markContentSaved(submitted));
  expect(get().contentForm.title).toBe("Second edit");
  expect(get().contentDirty).toBe(true);
  act(() => get().setContentForm(submitted));
  expect(get().contentDirty).toBe(false);
});
