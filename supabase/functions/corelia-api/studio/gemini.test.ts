import { describe, expect, it } from "vitest";
import { buildVideoSegmentRequest, callVideoSegment, GEMINI_API_BASE, GEMINI_VIDEO_SEGMENT_SCHEMA } from "./gemini.ts";

const VIDEO = "https://www.youtube.com/watch?v=aaaaaaaaaaa";
const KEY = "test-key-not-real";
const answer = {
  video_url: VIDEO,
  fits: true,
  mode: "segment",
  start_seconds: 120,
  end_seconds: 480,
  needs_prior_context: false,
  key_points: ["one", "two", "three"],
  reason: "covers it",
};

const okBody = (text: string, extra: object = {}) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 50 },
  responseId: "resp-1",
  ...extra,
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const call = (fetchFn: typeof fetch, extra: object = {}) =>
  callVideoSegment({ apiKey: KEY, model: "gemini-3.8-flash", videoUrl: VIDEO, system: "sys", input: { lesson: "x" }, fetchFn, ...extra });

describe("studio Gemini call for A8", () => {
  it("returns the parsed answer and the usage, with the key only in a header", async () => {
    let seenUrl = "";
    let seenInit: RequestInit | undefined;
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      seenUrl = String(url);
      seenInit = init;
      return jsonResponse(okBody(JSON.stringify(answer)));
    }) as unknown as typeof fetch;

    const result = await call(fetchFn);
    expect(result).toEqual({
      ok: true,
      output: answer,
      usage: { input_tokens: 1200, output_tokens: 350 },
      response_id: "resp-1",
    });
    expect(seenUrl).toBe(`${GEMINI_API_BASE}/models/gemini-3.8-flash:generateContent`);
    expect(seenUrl).not.toContain(KEY);
    expect(String(seenInit?.body)).not.toContain(KEY);
    expect((seenInit?.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
  });

  it("sends the video as a file part by its URL, with JSON output under the A8 schema", () => {
    const body = buildVideoSegmentRequest({ videoUrl: VIDEO, system: "sys", input: { a: 1 } }) as any;
    expect(body.contents[0].parts[0]).toEqual({ fileData: { fileUri: VIDEO } });
    expect(JSON.parse(body.contents[0].parts[1].text)).toEqual({ a: 1 });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBe(GEMINI_VIDEO_SEGMENT_SCHEMA);
    expect(GEMINI_VIDEO_SEGMENT_SCHEMA.required).toContain("key_points");
  });

  it("treats a timeout as a transport failure", async () => {
    const fetchFn = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      })) as unknown as typeof fetch;
    expect(await call(fetchFn, { timeoutMs: 5 })).toEqual({
      ok: false,
      cause: "transport",
      error: "Gemini không trả lời trong thời gian cho phép",
    });
  });

  it("treats a network error and HTTP 408, 429 and 5xx as transport failures", async () => {
    const network = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    expect(await call(network)).toMatchObject({ ok: false, cause: "transport" });
    for (const status of [408, 429, 500, 503]) {
      const fetchFn = (async () => new Response("{}", { status })) as unknown as typeof fetch;
      expect(await call(fetchFn)).toMatchObject({ ok: false, cause: "transport", error: `Gemini HTTP ${status}`, status });
    }
  });

  it("treats other 4xx answers as a refusal of this video, and key or permission errors as provider failures", async () => {
    for (const status of [400, 404, 410]) {
      const refused = (async () => new Response("{}", { status })) as unknown as typeof fetch;
      expect(await call(refused)).toMatchObject({ ok: false, cause: "candidate", status });
    }
    for (const status of [401, 403]) {
      const keyProblem = (async () => new Response("{}", { status })) as unknown as typeof fetch;
      expect(await call(keyProblem)).toMatchObject({ ok: false, cause: "provider", status });
    }
  });

  it("treats a blocked answer and text that is not JSON as provider failures", async () => {

    const cut = (async () => jsonResponse(okBody(JSON.stringify(answer), { candidates: [{ content: { parts: [{ text: "{}" }] }, finishReason: "MAX_TOKENS" }] }))) as unknown as typeof fetch;
    expect(await call(cut)).toMatchObject({ ok: false, cause: "provider" });

    const notJson = (async () => jsonResponse(okBody("not json at all"))) as unknown as typeof fetch;
    expect(await call(notJson)).toEqual({ ok: false, cause: "provider", error: "Câu trả lời của Gemini không phải JSON theo schema" });
  });
});
