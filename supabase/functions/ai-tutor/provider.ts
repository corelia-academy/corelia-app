import type { MessageComplexity, QuotaResult } from "./types.ts";
import { parseSseStream } from "./lib/sse.ts";

export type ProviderName = "openai";

export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string | AIContentPart[];
};

export type AIProviderRequest = {
  messages: AIMessage[];
  quota: QuotaResult;
  contextType: string;
  complexity: MessageComplexity;
};

export type StreamCallbacks = {
  onTextDelta: (delta: string) => Promise<void> | void;
};

export type StreamResult = {
  provider: ProviderName;
  model: string;
  outputText: string;
  usage?: { inputTokens: number; outputTokens: number };
};

function readEnv(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

function chooseModel(
  quota: QuotaResult,
  contextType: string,
  complexity: MessageComplexity,
): string {
  if (
    contextType === "lesson" &&
    !quota.haikuOnly &&
    !quota.attemptRateLimited &&
    complexity === "complex"
  ) {
    return readEnv("CORELIA_OPENAI_COMPLEX_MODEL") || "gpt-4o";
  }
  return readEnv("CORELIA_OPENAI_DEFAULT_MODEL") || "gpt-4o-mini";
}

async function streamOpenAi(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");

  const model = chooseModel(request.quota, request.contextType, request.complexity);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: 800,
      messages: request.messages,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });
  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => "");
    console.error("[ai-tutor] openai error", response.status, errBody);
    throw new Error(`OpenAI ${response.status}: ${errBody.slice(0, 500)}`);
  }

  let outputText = "";
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  for await (const event of parseSseStream(response.body)) {
    if (!event.data || event.data === "[DONE]") continue;
    const parsed = JSON.parse(event.data) as {
      choices?: Array<{ delta?: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const delta = parsed.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) {
      outputText += delta;
      await callbacks.onTextDelta(delta);
    }
    if (parsed.usage) {
      usage = {
        inputTokens: parsed.usage.prompt_tokens,
        outputTokens: parsed.usage.completion_tokens,
      };
    }
  }

  return {
    provider: "openai",
    model,
    outputText,
    usage,
  };
}

export async function streamProviderText(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  return streamOpenAi(request, callbacks);
}
