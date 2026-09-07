// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/locales/en/contests.json";
import viCopy from "@/locales/vi/contests.json";
import { ContestPreparationCard } from "./ContestPreparationCard";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ language: "vi", success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values: Record<string, string> = {}) => {
      const copy = state.language === "vi" ? viCopy.public.prepare : en.public.prepare;
      return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), copy[key.split(".").pop() as keyof typeof copy]);
    },
  }),
}));

async function renderCard() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(<ContestPreparationCard contest={{ title: "Demo & Build", slug: "demo-build" }} />));
  return { container, cleanup: async () => { await act(async () => root.unmount()); container.remove(); } };
}

describe("ContestPreparationCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    state.language = "vi";
  });

  it.each(["vi", "en"])("copies the visible %s prompt with public source links", async (language) => {
    state.language = language;
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const view = await renderCard();
    try {
      const field = view.container.querySelector("textarea")!;
      expect(field.readOnly).toBe(true);
      expect(field.value).toContain("Demo & Build");
      for (const tab of ["overview", "prizes", "resources"]) expect(field.value).toContain(`/hackathons/demo-build/${tab}`);
      expect(field.value).not.toContain("{{");
      await act(async () => view.container.querySelector("button")!.click());
      expect(writeText).toHaveBeenCalledWith(field.value);
      expect(state.success).toHaveBeenCalledWith(language === "vi" ? viCopy.public.prepare.copied : en.public.prepare.copied);
    } finally {
      await view.cleanup();
    }
  });

  it("keeps the prompt available for manual copying when clipboard access fails", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Permission denied"));
    const view = await renderCard();
    try {
      await act(async () => view.container.querySelector("button")!.click());
      expect(state.error).toHaveBeenCalledWith(viCopy.public.prepare.copyFailed);
      expect(state.success).not.toHaveBeenCalled();
      expect(view.container.querySelector("textarea")?.value).toContain("Demo & Build");
    } finally {
      await view.cleanup();
    }
  });
});
