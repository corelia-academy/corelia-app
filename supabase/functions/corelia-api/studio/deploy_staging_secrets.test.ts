import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_NAME, agentKeyEnv, type AgentRole } from "./steps.ts";

describe("Studio staging secret contract", () => {
  it("requires the cron secret and every agent key defined by agentKeyEnv", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/deploy-staging.yml"), "utf8");
    const requiredBlock = workflow.match(/studio_required_secrets=\(([\s\S]*?)\n\s*\)/);
    expect(requiredBlock, "staging workflow Studio secret array").not.toBeNull();

    const configured = [...requiredBlock![1]!.matchAll(/^\s*(CORELIA_STUDIO_[A-Z0-9_]+)\s*$/gm)]
      .map(([, name]) => name!);
    const openAiKeys = configured.filter((name) => name.endsWith("_OPENAI_API_KEY"));
    // A8 (video segment) uses Gemini and an optional key: without it, video lessons are written as articles.
    const roles = (Object.keys(AGENT_NAME) as AgentRole[]).filter((role) => role !== "A8");
    expect(agentKeyEnv("A8")).toBe("CORELIA_STUDIO_A8_VIDEO_GEMINI_API_KEY");

    expect(configured).toHaveLength(8);
    expect(new Set(configured).size).toBe(8);
    expect(configured).toContain("CORELIA_STUDIO_CRON_SECRET");
    expect(openAiKeys.sort()).toEqual(roles.map(agentKeyEnv).sort());
    expect(workflow).toContain('for secret_name in "${studio_required_secrets[@]}"; do');
    expect(workflow).toContain("jq --exit-status --arg name \"$secret_name\"");
    expect(workflow.indexOf("- name: Verify scheduler, email provider, and Studio secrets are configured"))
      .toBeLessThan(workflow.indexOf("- name: Apply Supabase migrations"));
  });
});
