// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PracticeBuilder } from "./PracticeBuilder";
import type { PracticeConfig } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("../useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../PracticeProject", () => ({ PracticeProjectField: () => null }));
vi.mock("../PracticeHackathon", () => ({ PracticeHackathonField: () => null }));
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function mount(initial: PracticeConfig) {
  let current = initial;
  function Consumer() {
    const [config, setConfig] = useState(initial);
    return <PracticeBuilder config={config} onChange={next => { current = next; setConfig(next); }} />;
  }
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Consumer />));
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  return { host, current: () => current,
    mode: async (mode: string) => { await act(async () => {
      const select = host.querySelector("select")!; select.value = mode;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }); },
    click: async (label: string) => { await act(async () => {
      const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent === label);
      expect(button).toBeTruthy(); button!.click();
    }); },
  };
}

it.each(["instruction", "checklist"])("does not hide artifact gates when switching to %s", async mode => {
  const initial: PracticeConfig = { mode: "guided_project", revision: 4, related_project_id: "project", submission_fields: ["github_url"], project_steps: [{ id: "step", title: "Ship", order: 0, verification: "artifact_required", artifact_fields: ["github_url"] }] };
  const ui = mount(initial);
  await ui.mode(mode);
  expect(ui.current()).toEqual(initial);
  await ui.click("learning.cancel");
  expect(ui.current()).toEqual(initial);
  await ui.mode(mode);
  await ui.click("learning.confirmAction");
  expect(ui.current()).toMatchObject({ mode, submission_fields: [], project_steps: [], revision: 4, related_project_id: "project" });
});

it("keeps artifacts for submission but confirms removal of guided steps", async () => {
  const ui = mount({ mode: "guided_project", submission_fields: ["notes"], project_steps: [{ id: "step", title: "Ship", order: 0, verification: "self_check" }] });
  await ui.mode("submission");
  await ui.click("learning.confirmAction");
  expect(ui.current()).toMatchObject({ mode: "submission", submission_fields: ["notes"], project_steps: [] });
});

it("shows existing legacy artifact requirements and lets the author remove them explicitly", async () => {
  const ui = mount({ mode: "instruction", submission_fields: ["github_url"] });
  expect(ui.host.querySelector('[role="alert"]')?.textContent).toBe("learning.legacyPracticeArtifacts");
  const field = ui.host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(field.checked).toBe(true);
  await act(async () => field.click());
  expect(ui.current().submission_fields).toEqual([]);
  expect(ui.host.querySelector("fieldset")).toBeNull();
});
