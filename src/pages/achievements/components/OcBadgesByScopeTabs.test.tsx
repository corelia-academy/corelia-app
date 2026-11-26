// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OcBadgesByScopeTabs } from "./OcBadgesByScopeTabs";
import type { BadgeItem } from "../types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }) }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function badge(overrides: Partial<BadgeItem>): BadgeItem {
  return {
    id: "badge",
    title: "Badge",
    description: "",
    locked: false,
    showOnProfile: true,
    credentialScope: "course",
    achievementType: "Achievement",
    ...overrides,
  } as BadgeItem;
}

async function render(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = () => { act(() => root.unmount()); container.remove(); };
  await act(async () => root.render(node));
  return container;
}

describe("OcBadgesByScopeTabs", () => {
  const items = [
    badge({ id: "oca", title: "Course certificate" }),
    badge({ id: "ocb", title: "Course badge", achievementType: "Badge" }),
    badge({ id: "xp", title: "XP milestone", credentialScope: "activity_milestone" }),
  ];

  it("keeps the original filter buttons by default", async () => {
    const container = await render(<OcBadgesByScopeTabs badges={items} loading={false} onOpenModal={vi.fn()} />);
    expect(container.textContent).toContain("Tất cả");
    expect(container.querySelectorAll("h2")).toHaveLength(0);
  });

  it("groups certificates and badges in the profile sections layout", async () => {
    const container = await render(<OcBadgesByScopeTabs layout="sections" badges={items} loading={false} onOpenModal={vi.fn()} />);
    const sections = [...container.querySelectorAll("section")];
    expect(sections.map((section) => section.getAttribute("aria-label"))).toEqual([
      "userProfile.achievements.certificatesTitle",
      "userProfile.achievements.badgesTitle",
    ]);
    expect(sections[0].textContent).toContain("Course certificate");
    expect(sections[1].textContent).toContain("Course badge");
    expect(sections[1].textContent).toContain("XP milestone");
  });

  it("shows the empty label when nothing is earned", async () => {
    const container = await render(<OcBadgesByScopeTabs layout="sections" badges={[]} loading={false} onOpenModal={vi.fn()} emptyLabel="Nothing yet" />);
    expect(container.textContent).toBe("Nothing yet");
  });
});
