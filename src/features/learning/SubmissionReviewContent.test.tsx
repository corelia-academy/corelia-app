// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SubmissionReviewContent } from "./SubmissionReviewContent";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", async importOriginal => ({ ...await importOriginal<typeof import("react-i18next")>(), useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./useLearningTranslation", () => ({ useLearningTranslation: () => ({ t: (key: string) => key }) }));

it("exposes full submission and feedback with safe attachment links", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const content = "First line\nSecond line\nRequired review detail on the third line";
  act(() => root.render(<SubmissionReviewContent content={content} comment="Please add persistence tests" fileUrls={["https://example.com/attachment.zip", "javascript:alert(1)"]} />));
  expect(container.querySelector("details")?.open).toBe(false);
  act(() => container.querySelector("summary")!.click());
  expect(container.querySelector("details")?.open).toBe(true);
  expect(container.textContent).toContain(content);
  expect(container.textContent).toContain("Please add persistence tests");
  expect(container.querySelectorAll("a")).toHaveLength(1);
  expect(container.querySelector("a")?.href).toBe("https://example.com/attachment.zip");
  expect(container.textContent).toContain("courseEdit.assignments.unavailableAttachment");
  act(() => root.unmount());
});
