import { describe, expect, it } from "vitest";
import { achievementIdentifier, issuerReferenceId, legacyIssuerReferenceId } from "./ids.ts";

describe("Open Campus identifier v2", () => {
  const userId = "37514c42-4327-4a3e-895a-3ef9eab82e3b";

  it("separates templates that reused the same legacy prefix", async () => {
    const first = issuerReferenceId("a42feaad-cdbe-47c8-988d-d8a6f63685d4", userId);
    const second = issuerReferenceId("9e6a77cb-6e22-48d5-b78d-be3914d53593", userId);

    expect(first).not.toBe(second);
    expect(legacyIssuerReferenceId("corelia:ocb", userId)).toBe(
      "corelia:ocb:37514c4243274a3e895a3ef9eab82e3b",
    );
    const firstAchievement = await achievementIdentifier(
      "corelia:ocb",
      "a42feaad-cdbe-47c8-988d-d8a6f63685d4",
      userId,
    );
    const secondAchievement = await achievementIdentifier(
      "corelia:ocb",
      "9e6a77cb-6e22-48d5-b78d-be3914d53593",
      userId,
    );
    expect(firstAchievement).toHaveLength(48);
    expect(firstAchievement).not.toBe(secondAchievement);
  });
});
