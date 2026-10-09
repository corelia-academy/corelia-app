// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { Timestamp, type TimestampProps } from "./timestamp";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedRoots: Array<{ root: Root; container: HTMLDivElement }> = [];

afterEach(async () => {
  for (const { root, container } of mountedRoots) {
    await act(async () => root.unmount());
    container.remove();
  }
  mountedRoots.length = 0;
});

async function renderTimestamp(props: TimestampProps) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push({ root, container });

  await act(async () => root.render(<Timestamp {...props} />));

  return container;
}

const modeCases = [
  {
    type: "full" as const,
    date: "DATE",
    time: "TIME",
    relativeText: "RELATIVE",
    timezone: "UTC+7",
    visible: ["DATE", "TIME", "UTC+7"],
    separators: 1,
  },
  {
    type: "today" as const,
    date: "DATE",
    time: "TIME",
    relativeText: "RELATIVE",
    timezone: "UTC+7",
    visible: ["RELATIVE", "TIME"],
    separators: 1,
  },
  {
    type: "date-only" as const,
    date: "DATE",
    time: "TIME",
    relativeText: "RELATIVE",
    timezone: "UTC+7",
    visible: ["DATE"],
    separators: 0,
  },
  {
    type: "time-only" as const,
    date: "DATE",
    time: "TIME",
    relativeText: "RELATIVE",
    timezone: "UTC+7",
    visible: ["TIME", "UTC+7"],
    separators: 0,
  },
  {
    type: "some-time-ago" as const,
    date: "DATE",
    time: "TIME",
    relativeText: "RELATIVE",
    timezone: "UTC+7",
    visible: ["RELATIVE"],
    separators: 0,
  },
];

describe("Timestamp", () => {
  it.each(modeCases)("shows the allowed content for $type", async ({
    visible,
    separators,
    ...props
  }) => {
    const container = await renderTimestamp(props);
    const timestamp = container.querySelector<HTMLElement>('[data-slot="timestamp"]');
    const renderedText = timestamp?.textContent ?? "";

    expect(timestamp?.tagName).toBe("DIV");

    for (const value of ["DATE", "TIME", "RELATIVE", "UTC+7"]) {
      expect(renderedText.includes(value)).toBe(visible.includes(value));
    }

    expect(timestamp?.querySelectorAll('[data-slot="separator"]')).toHaveLength(separators);
  });

  it("uses the Figma large text style and forwards div props", async () => {
    const container = await renderTimestamp({
      date: "DATE",
      time: "TIME",
      "data-testid": "timestamp-test",
    });
    const timestamp = container.querySelector<HTMLElement>('[data-testid="timestamp-test"]');

    expect(timestamp?.className).toContain("font-body");
    expect(timestamp?.className).toContain("text-sm");
    expect(timestamp?.className).toContain("leading-[1.4]");
    expect(timestamp?.className).toContain("tracking-[0.28px]");
    expect(timestamp?.className).toContain("not-italic");
    expect(timestamp?.className).toContain("text-center");
  });

  it("renders nothing when the selected fields are empty", async () => {
    const container = await renderTimestamp({ type: "full", date: null, time: "" });

    expect(container.querySelector('[data-slot="timestamp"]')).toBeNull();
  });
});
