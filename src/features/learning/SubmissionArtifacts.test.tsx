// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SubmissionArtifacts } from "./SubmissionArtifacts";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));

describe("review artifacts", () => {
  it("shows project links and notes while rendering invalid URLs as plain text", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => root.render(<SubmissionArtifacts artifacts={{ github_url: "https://github.com/example/cli", notes: "Persistence uses TSV.\nTests pass.", demo_url: "javascript:alert(1)" }} />));
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://github.com/example/cli");
    expect(container.textContent).toContain("Persistence uses TSV.");
    expect(container.textContent).toContain("javascript:alert(1)");
    act(() => root.unmount());
  });
});
