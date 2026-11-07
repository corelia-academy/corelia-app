import type { SupabaseClient } from "../lib/supabase.ts";
import { PROMPT_VERSIONS, promptVersion, type PromptKey } from "./prompts.ts";

export interface LoadedAgentPrompt {
  version: number;
  promptVersion: string;
  system: string;
}

/** Load the immutable version pinned for a new task or recorded on an existing generation. */
export async function loadAgentPrompt(db: SupabaseClient, key: PromptKey, requestedVersion = PROMPT_VERSIONS[key]): Promise<LoadedAgentPrompt> {
  if (!Number.isSafeInteger(requestedVersion) || requestedVersion < 1) {
    throw new Error(`Invalid Studio prompt version ${key}@v${requestedVersion}.`);
  }
  const version = requestedVersion;
  const { data, error } = await db
    .from("studio_agent_prompts")
    .select("version, system_prompt")
    .eq("prompt_key", key)
    .eq("version", version)
    .maybeSingle();

  if (error) throw new Error(`Could not load Studio prompt ${promptVersion(key, version)}: ${error.message}`);
  if (!data || data.version !== version || typeof data.system_prompt !== "string" || !data.system_prompt.trim()) {
    throw new Error(`Studio prompt ${promptVersion(key, version)} is missing or invalid in public.studio_agent_prompts.`);
  }

  return { version: data.version, promptVersion: promptVersion(key, data.version), system: data.system_prompt };
}
