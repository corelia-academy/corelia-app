import type { ProjectLink } from "./validation.ts";

const OPENAI_API_BASE = "https://api.openai.com/v1";

export class ProjectAiError extends Error {
  constructor(public readonly code: string, public readonly status = 422) {
    super(code);
  }
}

function apiKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";
  if (!key) throw new ProjectAiError("ai_unavailable:missing_api_key", 503);
  return key;
}

async function openAiFetch(path: string, body: unknown, timeoutMs = 20_000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${OPENAI_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      console.error("[projects.ai] OpenAI request failed", path, response.status);
      throw new ProjectAiError("ai_unavailable:provider_error", 503);
    }
    return json;
  } catch (error) {
    if (error instanceof ProjectAiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProjectAiError("ai_unavailable:timeout", 503);
    }
    throw new ProjectAiError("ai_unavailable:network", 503);
  } finally {
    clearTimeout(timer);
  }
}

type TextEntry = { field: string; text: string };

export async function moderateProjectText(entries: TextEntry[]): Promise<void> {
  const filtered = entries.filter((entry) => entry.text.trim());
  if (!filtered.length) return;
  const response = await openAiFetch("/moderations", {
    model: "omni-moderation-latest",
    input: filtered.map((entry) => entry.text),
  });
  const results = Array.isArray(response.results) ? response.results : [];
  if (results.length !== filtered.length) throw new ProjectAiError("ai_unavailable:invalid_response", 503);
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index] as Record<string, unknown>;
    if (typeof result.flagged !== "boolean") {
      throw new ProjectAiError("ai_unavailable:invalid_response", 503);
    }
    if (result.flagged === true) {
      throw new ProjectAiError(`moderation_blocked:${filtered[index]!.field}`);
    }
  }
}

export async function moderateProjectImage(bytes: Uint8Array, mime: string): Promise<void> {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const dataUrl = `data:${mime};base64,${btoa(binary)}`;
  const response = await openAiFetch("/moderations", {
    model: "omni-moderation-latest",
    input: [{ type: "image_url", image_url: { url: dataUrl } }],
  });
  const result = Array.isArray(response.results) ? response.results[0] as Record<string, unknown> | undefined : undefined;
  if (!result || typeof result.flagged !== "boolean") {
    throw new ProjectAiError("ai_unavailable:invalid_response", 503);
  }
  if (result.flagged === true) throw new ProjectAiError("moderation_blocked:image");
}

function responseText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = typeof item === "object" && item !== null && Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (typeof part === "object" && part !== null && typeof (part as Record<string, unknown>).text === "string") {
        return (part as Record<string, unknown>).text as string;
      }
    }
  }
  return "";
}

export async function verifyPublicProjectLinks(links: ProjectLink[]): Promise<void> {
  if (!links.length) return;
  const response = await openAiFetch("/responses", {
    model: "gpt-5.4-mini",
    store: false,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: "Verify each submitted project URL using public web search. A URL passes only if its public destination can be verified and is not associated with gambling, pornography, sexual services, malware, scams, illegal commerce, hate, violence, self-harm, or other harmful/abusive content. repo_url must resolve to an actual public GitHub repository, demo_url to a public project demo, and slide_url to public project slides. Do not trust the URL text alone. Return exactly one check per input field.",
      },
      { role: "user", content: JSON.stringify(links) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "project_link_checks",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            checks: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  field: { type: "string", enum: ["demo_url", "repo_url", "slide_url"] },
                  verified: { type: "boolean" },
                  allowed: { type: "boolean" },
                  reason: { type: "string" },
                },
                required: ["field", "verified", "allowed", "reason"],
              },
            },
          },
          required: ["checks"],
        },
      },
    },
  }, 30_000);

  let parsed: { checks?: Array<{ field?: string; verified?: boolean; allowed?: boolean }> };
  try {
    parsed = JSON.parse(responseText(response));
  } catch {
    throw new ProjectAiError("ai_unavailable:invalid_response", 503);
  }
  const checks = Array.isArray(parsed.checks) ? parsed.checks : [];
  for (const link of links) {
    const check = checks.find((item) => item.field === link.field);
    if (!check || check.verified !== true) throw new ProjectAiError(`link_unverifiable:${link.field}`);
    if (check.allowed !== true) throw new ProjectAiError(`link_blocked:${link.field}`);
  }
}
