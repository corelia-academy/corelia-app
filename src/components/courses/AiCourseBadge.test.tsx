// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AiCourseBadge } from "./AiCourseBadge";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

async function render(course: Parameters<typeof AiCourseBadge>[0]["course"]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => { act(() => root.unmount()); host.remove(); };
  await act(async () => root.render(<TooltipProvider><AiCourseBadge course={course} /></TooltipProvider>));
  return host;
}

it("shows the AI label only for ai_generated courses", async () => {
  expect((await render({ course_type: "ai_generated" })).textContent).toContain("aiGenerated.label");
  cleanup?.();
  expect((await render({})).textContent).toBe("");
});
