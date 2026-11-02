// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CodeExerciseBuilder } from "./CodeExerciseBuilder";
import { defaultCodeConfig } from "../config";
import type { CodeExerciseConfig, CodeExerciseFillConfig, CodeExerciseTwoStageConfig } from "../types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("@/features/learning/useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/features/learning/useLearningConfirm", () => ({ useLearningConfirm: () => ({ confirm: async () => true, confirmation: null }) }));
vi.mock("../CodeEditor", () => ({ CodeEditor: ({ language }: { language: string }) => <div data-language={language} /> }));
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

it("keeps author content on language change and uses that language when switching modes", async () => {
  const original: CodeExerciseFillConfig = { ...defaultCodeConfig("fill"), hints: ["Keep hint"], reference_solution: "custom answer" };
  let latest: CodeExerciseConfig = original;
  function Harness() {
    const [config, setConfig] = useState<CodeExerciseConfig>(original);
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

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

it("renders reference solution and hints fields in fill/edit mode and updates via onChange", async () => {
  const original: CodeExerciseFillConfig = defaultCodeConfig("fill");
  let latest: CodeExerciseConfig = original;
  function Harness() {
    const [config, setConfig] = useState<CodeExerciseConfig>(original);
    return <CodeExerciseBuilder config={config} onChange={value => { latest = value; setConfig(value); }} />;
  }
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<Harness />));

  const refInput = host.querySelector<HTMLTextAreaElement>("#learning-code-reference")!;
  expect(refInput).not.toBeNull();
  await act(async () => {
    setNativeValue(refInput, "let mut count = 0;");
  });
  expect((latest as CodeExerciseFillConfig).reference_solution).toBe("let mut count = 0;");

  const hintsInput = host.querySelector<HTMLTextAreaElement>("#learning-code-hints")!;
  expect(hintsInput).not.toBeNull();
  await act(async () => {
    setNativeValue(hintsInput, "Hint 1\nHint 2");
  });
  expect((latest as CodeExerciseFillConfig).hints).toEqual(["Hint 1", "Hint 2"]);
});

it("renders two_stage exercise in safe read-only notice mode", () => {
  const config: CodeExerciseTwoStageConfig = defaultCodeConfig("two_stage");
  const host = document.createElement("div"), root = createRoot(host);
  cleanup = () => act(() => root.unmount());
  act(() => root.render(<CodeExerciseBuilder config={config} onChange={() => {}} />));

  expect(host.querySelector("#learning-code-reference")).toBeNull();
  expect(host.querySelector("#learning-code-hints")).toBeNull();
  expect(host.textContent).toContain("learning.twoStageNotice");
  expect(host.textContent).toContain("learning.codePart1");
  expect(host.textContent).toContain("learning.codePart2");
});
