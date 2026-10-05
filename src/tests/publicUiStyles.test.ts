import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("../styles/public-ui.css", import.meta.url),
  "utf8",
);

describe("public UI input focus outline", () => {
  it("leaves the shared Input focus ring to its own control wrapper", () => {
    expect(stylesheet).toContain(
      '.public-ui :is(a, button, input:not([data-slot="input"]), select, summary):focus-visible',
    );
    expect(stylesheet).not.toContain(
      ".public-ui :is(a, button, input, select, summary):focus-visible",
    );
  });
});
