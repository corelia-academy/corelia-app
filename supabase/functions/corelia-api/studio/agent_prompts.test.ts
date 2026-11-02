import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "../lib/supabase.ts";
import { loadAgentPrompt } from "./agent_prompts.ts";
import { PROMPT_VERSIONS } from "./prompts.ts";

function promptDb(result: { data: unknown; error: { message: string } | null }) {
  const query: Record<string, any> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  const db = { from: vi.fn(() => query) } as unknown as SupabaseClient;
  return { db, query };
}

describe("Studio agent prompt lookup", () => {
  const version = PROMPT_VERSIONS["a2-research"];

  it("loads the code-pinned numeric version once and returns prompt text and provenance from that row", async () => {
    const { db, query } = promptDb({ data: { version, system_prompt: "database prompt body" }, error: null });
    const prompt = await loadAgentPrompt(db, "a2-research");

    expect(db.from).toHaveBeenCalledTimes(1);
    expect(db.from).toHaveBeenCalledWith("studio_agent_prompts");
    expect(query.select).toHaveBeenCalledWith("version, system_prompt");
    expect(query.eq.mock.calls).toEqual([["prompt_key", "a2-research"], ["version", version]]);
    expect(prompt).toEqual({ version, promptVersion: `a2-research@v${version}`, system: "database prompt body" });
  });

  it("fails clearly when the pinned version is missing instead of falling back", async () => {
    const { db } = promptDb({ data: null, error: null });
    await expect(loadAgentPrompt(db, "a2-research")).rejects.toThrow(`Studio prompt a2-research@v${version} is missing or invalid in public.studio_agent_prompts.`);
  });

  it("surfaces database lookup errors with the requested prompt version", async () => {
    const { db } = promptDb({ data: null, error: { message: "permission denied" } });
    await expect(loadAgentPrompt(db, "a2-research")).rejects.toThrow(`Could not load Studio prompt a2-research@v${version}: permission denied`);
  });

  it("rejects an empty prompt row", async () => {
    const { db } = promptDb({ data: { version, system_prompt: "  " }, error: null });
    await expect(loadAgentPrompt(db, "a2-research")).rejects.toThrow(`Studio prompt a2-research@v${version} is missing or invalid`);
  });
});
