// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CodeExerciseBuilder } from "./CodeExerciseBuilder";
import { defaultCodeConfig } from "../config";
import type { CodeExerciseConfig } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/features/learning/useLearningConfirm", () => ({ useLearningConfirm: () => ({ confirm: async () => true, confirmation: null }) }));
vi.mock("../CodeEditor", () => ({ CodeEditor: ({ language }: { language: string }) => <div data-language={language} /> }));
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

it("keeps author content on language change and uses that language when switching modes", async () => {
  const original: CodeExerciseConfig = { ...defaultCodeConfig(), hints: ["Keep hint"], reference_solution: "custom answer" };
  let latest = original;
  function Harness() {
    const [config, setConfig] = useState(original);
    return <CodeExerciseBuilder config={config} onChange={value => { latest = value; setConfig(value); }} />;
  }
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<Harness />));
  const language = host.querySelector<HTMLSelectElement>("#learning-code-language")!;
  await act(async () => { language.value = "python"; language.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(latest).toEqual({ ...original, language: "python", file: { ...original.file, path: "lib.py" } });
  const mode = host.querySelector<HTMLSelectElement>("select")!;
  await act(async () => { mode.value = "edit"; mode.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(latest).toEqual(defaultCodeConfig("edit", "python"));
  expect(host.querySelector("[data-language]")?.getAttribute("data-language")).toBe("python");
});
