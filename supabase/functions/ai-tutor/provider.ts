import type { MessageComplexity, QuotaResult } from "./types.ts";

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

export async function streamProviderText(
  _request: AIProviderRequest,
  _callbacks: StreamCallbacks,
): Promise<StreamResult> {
  throw new Error("AI provider has been decommissioned under Epic #332.");
}
