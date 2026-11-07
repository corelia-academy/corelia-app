import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_EFFORTS,
  DEFAULT_AGENT_MODELS,
  resolveAgentEfforts,
  resolveAgentModels,
} from "./agent_preferences.ts";

describe("Claude Code Studio agent preferences", () => {
  it("defaults every child role to Haiku and keeps Studio's per-role effort profile", () => {
    expect(DEFAULT_AGENT_MODELS).toEqual({
      A1: "haiku",
      A2: "haiku",
      A3: "haiku",
      A4: "haiku",
      A5: "haiku",
      A6: "haiku",
      A7: "haiku",
    });
    expect(DEFAULT_AGENT_EFFORTS).toEqual({
      A1: "max",
      A2: "xhigh",
      A3: "xhigh",
      A4: "xhigh",
      A5: "high",
      A6: "xhigh",
      A7: "xhigh",
    });
  });

  it("merges per-role overrides without resetting the other defaults", () => {
    expect(resolveAgentModels({ A3: "opus" })).toEqual({
      ...DEFAULT_AGENT_MODELS,
      A3: "opus",
    });
    expect(resolveAgentEfforts({ A5: "max", A7: "high" })).toEqual({
      ...DEFAULT_AGENT_EFFORTS,
      A5: "max",
      A7: "high",
    });
  });
});
