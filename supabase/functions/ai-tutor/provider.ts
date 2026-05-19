import type { MessageComplexity, QuotaResult } from "./types.ts";
import { parseSseStream } from "./lib/sse.ts";

export type ProviderName = "stub" | "openai" | "anthropic";

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
};

function readEnv(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

function resolveProviderName(): ProviderName {
  const configured = readEnv("CORELIA_AI_PROVIDER").toLowerCase();
  if (configured === "openai" || configured === "anthropic" || configured === "stub") {
    return configured;
  }
  if (readEnv("OPENAI_API_KEY")) return "openai";
  if (readEnv("ANTHROPIC_API_KEY")) return "anthropic";
  return "stub";
}

function chooseModel(
  provider: ProviderName,
  quota: QuotaResult,
  contextType: string,
  complexity: MessageComplexity,
): string {
  if (provider === "openai") {
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
  if (provider === "anthropic") {
    if (
      contextType === "lesson" &&
      !quota.haikuOnly &&
      !quota.throttled &&
      complexity === "complex"
    ) {
      return readEnv("CORELIA_ANTHROPIC_COMPLEX_MODEL") || "claude-sonnet-4-5";
    }
    return readEnv("CORELIA_ANTHROPIC_DEFAULT_MODEL") || "claude-3-5-haiku-latest";
  }
  return "stub-cora";
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

  const model = chooseModel("openai", request.quota, request.contextType, request.complexity);
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
  for await (const event of parseSseStream(response.body)) {
    if (!event.data || event.data === "[DONE]") continue;
    const parsed = JSON.parse(event.data) as {
      type?: string;
      delta?: string;
      error?: { message?: string };
    };
    if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
      outputText += parsed.delta;
      await callbacks.onTextDelta(parsed.delta);
    } else if (parsed.type === "error") {
      throw new Error(parsed.error?.message ?? "OpenAI streaming error");
    }
  }

  return {
    provider: "openai",
    model,
    outputText: outputText || request.fallbackText,
  };
}

async function streamAnthropic(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) return streamStub(request, callbacks);

  const model = chooseModel("anthropic", request.quota, request.contextType, request.complexity);
  const [systemMessage, ...conversation] = request.messages;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      stream: true,
      system: systemMessage?.role === "system" ? systemMessage.content : undefined,
      messages: conversation.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      })),
    }),
  });
  if (!response.ok || !response.body) {
    console.error("[ai-tutor] anthropic error", response.status, await response.text().catch(() => ""));
    return streamStub(request, callbacks);
  }

  let outputText = "";
  for await (const event of parseSseStream(response.body)) {
    if (!event.data) continue;
    const parsed = JSON.parse(event.data) as {
      type?: string;
      delta?: { type?: string; text?: string };
      error?: { message?: string };
    };
    if (
      parsed.type === "content_block_delta" &&
      parsed.delta?.type === "text_delta" &&
      typeof parsed.delta.text === "string"
    ) {
      outputText += parsed.delta.text;
      await callbacks.onTextDelta(parsed.delta.text);
    } else if (parsed.type === "error") {
      throw new Error(parsed.error?.message ?? "Anthropic streaming error");
    }
  }

  return {
    provider: "anthropic",
    model,
    outputText: outputText || request.fallbackText,
  };
}

export async function streamProviderText(
  request: AIProviderRequest,
  callbacks: StreamCallbacks,
): Promise<StreamResult> {
  const provider = resolveProviderName();
  if (provider === "openai") return streamOpenAi(request, callbacks);
  if (provider === "anthropic") return streamAnthropic(request, callbacks);
  return streamStub(request, callbacks);
}
