import type { MessageComplexity, QuotaResult } from "./types.ts";
import { parseSseStream } from "./lib/sse.ts";

export type ProviderName = "stub" | "openai";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProviderRequest = {
  messages: AIMessage[];
  quota: QuotaResult;
  fallbackText: string;
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
    !quota.throttled &&
    complexity === "complex"
  ) {
    return readEnv("CORELIA_OPENAI_COMPLEX_MODEL") || "gpt-5-mini";
  }
  return readEnv("CORELIA_OPENAI_DEFAULT_MODEL") || "gpt-5-mini";
}

async function streamStub(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const text = request.fallbackText;
  const tokens = text.split(/(\s+)/).filter(Boolean);
  let output = "";
  for (const token of tokens) {
    output += token;
    await callbacks.onTextDelta(token);
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  return {
    provider: "stub",
    model: "stub-cora",
    outputText: output,
  };
}

async function streamOpenAi(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return streamStub(request, callbacks);

  const model = chooseModel(request.quota, request.contextType, request.complexity);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 800,
      input: request.messages.map((message) => ({
        role: message.role,
        content: [{ type: "input_text", text: message.content }],
      })),
      stream: true,
    }),
  });
  if (!response.ok || !response.body) {
    console.error("[ai-tutor] openai error", response.status, await response.text().catch(() => ""));
    return streamStub(request, callbacks);
  }

  let outputText = "";
  let usage: { inputTokens: number; outputTokens: number } | undefined;

  for await (const event of parseSseStream(response.body)) {
    if (!event.data || event.data === "[DONE]") continue;
    const parsed = JSON.parse(event.data) as {
      type?: string;
      delta?: string;
      error?: { message?: string };
      response?: { usage?: { input_tokens: number; output_tokens: number } };
    };
    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      outputText += parsed.delta;
      await callbacks.onTextDelta(parsed.delta);
    } else if (parsed.type === "response.completed" && parsed.response?.usage) {
      usage = {
        inputTokens: parsed.response.usage.input_tokens,
        outputTokens: parsed.response.usage.output_tokens,
      };
    } else if (parsed.type === "error") {
      throw new Error(parsed.error?.message ?? "OpenAI streaming error");
    }
  }

  return {
    provider: "openai",
    model,
    outputText: outputText || request.fallbackText,
    usage,
  };
}

export async function streamProviderText(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const configured = readEnv("CORELIA_AI_PROVIDER").toLowerCase();
  if (configured === "stub") return streamStub(request, callbacks);
  if (readEnv("OPENAI_API_KEY") || configured === "openai") {
    return streamOpenAi(request, callbacks);
  }
  return streamStub(request, callbacks);
}
