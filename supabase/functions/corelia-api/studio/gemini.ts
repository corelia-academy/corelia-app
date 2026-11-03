// Gemini generateContent for step A8 (video segment): one synchronous request for one candidate video,
// under a timeout well below the Edge request limit. This module is transport only: it returns the
// model's JSON answer and the usage, and the caller judges the answer (video_segment.ts).
//
// The request shape follows the public REST reference for generateContent (fileData.fileUri for a
// public YouTube URL, responseMimeType and responseSchema for JSON output). The docs host was not
// reachable when this was written, so the field names have not been checked against the live docs.

/** Base of the Gemini REST API. */
export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
/** Longest wait for one candidate. Past it the attempt is a transport failure and is retried by the run's rules. */
export const VIDEO_SEGMENT_TIMEOUT_MS = 60_000;
/** Output budget of one answer: the JSON is short (one candidate and at most five key points). */
export const VIDEO_SEGMENT_MAX_OUTPUT_TOKENS = 2_000;

/** Response schema of the A8 answer, in the upper-case type names of the Gemini schema. */
export const GEMINI_VIDEO_SEGMENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    video_url: { type: "STRING" },
    fits: { type: "BOOLEAN" },
    mode: { type: "STRING", enum: ["segment", "whole"] },
    start_seconds: { type: "INTEGER" },
    end_seconds: { type: "INTEGER" },
    needs_prior_context: { type: "BOOLEAN" },
    key_points: { type: "ARRAY", items: { type: "STRING" } },
    reason: { type: "STRING" },
  },
  required: ["video_url", "fits", "mode", "start_seconds", "end_seconds", "needs_prior_context", "key_points", "reason"],
};

export type GeminiCall =
  | { ok: true; output: unknown; usage: { input_tokens: number; output_tokens: number }; response_id: string | null }
  | { ok: false; cause: "transport" | "provider"; error: string };

/** The body of one request: the video as a file part, then the lesson input as text, JSON out. */
export function buildVideoSegmentRequest(args: { videoUrl: string; system: string; input: unknown }): Record<string, unknown> {
  return {
    systemInstruction: { parts: [{ text: args.system }] },
    contents: [{
      role: "user",
      parts: [
        { fileData: { fileUri: args.videoUrl } },
        { text: JSON.stringify(args.input) },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_VIDEO_SEGMENT_SCHEMA,
      maxOutputTokens: VIDEO_SEGMENT_MAX_OUTPUT_TOKENS,
    },
  };
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Sends one request. The key goes in a header, never in the URL or the body. A timeout, a network error,
 * or an HTTP 408, 429 or 5xx is a transport failure (it says nothing about the answer); any other HTTP
 * error, a blocked or unfinished answer, or text that is not JSON is a provider failure.
 */
export async function callVideoSegment(args: {
  apiKey: string;
  model: string;
  videoUrl: string;
  system: string;
  input: unknown;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}): Promise<GeminiCall> {
  const fetchFn = args.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? VIDEO_SEGMENT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchFn(`${GEMINI_API_BASE}/models/${encodeURIComponent(args.model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": args.apiKey },
      body: JSON.stringify(buildVideoSegmentRequest(args)),
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return { ok: false, cause: "transport", error: timedOut ? "Gemini không trả lời trong thời gian cho phép" : `Không gửi được yêu cầu tới Gemini: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const transport = res.status === 408 || res.status === 429 || res.status >= 500;
    return { ok: false, cause: transport ? "transport" : "provider", error: `Gemini HTTP ${res.status}` };
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    return { ok: false, cause: "provider", error: "Gemini trả về nội dung không đọc được" };
  }
  const candidate = Array.isArray(body?.candidates) ? body.candidates[0] : undefined;
  if (!candidate || candidate.finishReason !== "STOP") {
    return { ok: false, cause: "provider", error: `Gemini không hoàn tất câu trả lời (${candidate?.finishReason ?? "không có kết quả"})` };
  }
  const text = (Array.isArray(candidate.content?.parts) ? candidate.content.parts : [])
    .map((part: { text?: unknown }) => (typeof part.text === "string" ? part.text : ""))
    .join("");
  let output: unknown;
  try {
    output = JSON.parse(text);
  } catch {
    return { ok: false, cause: "provider", error: "Câu trả lời của Gemini không phải JSON theo schema" };
  }
  return {
    ok: true,
    output,
    usage: {
      input_tokens: numberField(body.usageMetadata?.promptTokenCount),
      output_tokens: numberField(body.usageMetadata?.candidatesTokenCount) + numberField(body.usageMetadata?.thoughtsTokenCount),
    },
    response_id: typeof body.responseId === "string" ? body.responseId : null,
  };
}
