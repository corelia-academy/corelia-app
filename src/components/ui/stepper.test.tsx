// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Stepper } from "./stepper";

describe("Stepper connector halves", () => {
  it("renders a full connector followed by a half-active connector", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <Stepper
        steps={[
          { title: "Passed", state: "Passed", connectorAfter: "Active" },
          {
            title: "Focused",
            state: "Focused",
            connectorBefore: "Active",
            connectorAfter: "Active",
          },
          { title: "Default", state: "Default" },
        ]}
      />,
    );

    const steps = host.querySelectorAll("li");
    const active = "bg-[var(--stepper-connector-active)]";
    const muted = "bg-[var(--stepper-connector-default)]";

    expect(steps[0]?.querySelector('[data-slot="stepper-connector-after"]')?.classList.contains(active)).toBe(true);
    expect(steps[1]?.querySelector('[data-slot="stepper-connector-before"]')?.classList.contains(active)).toBe(true);
    expect(steps[1]?.querySelector('[data-slot="stepper-connector-after"]')?.classList.contains(active)).toBe(true);
    expect(steps[2]?.querySelector('[data-slot="stepper-connector-before"]')?.classList.contains(muted)).toBe(true);
  });

  it("uses the shared error token for each explicitly errored half", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <Stepper
        steps={[
          { title: "Review", connectorAfter: "Error" },
          { title: "Needs attention", state: "Error", connectorBefore: "Error" },
        ]}
      />,
    );

    const steps = host.querySelectorAll("li");
    const error = "bg-[var(--stepper-connector-error)]";

    expect(steps[0]?.querySelector('[data-slot="stepper-connector-after"]')?.classList.contains(error)).toBe(true);
    expect(steps[1]?.querySelector('[data-slot="stepper-connector-before"]')?.classList.contains(error)).toBe(true);
  });
});
