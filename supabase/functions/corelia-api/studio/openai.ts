// OpenAI Responses API in background mode: submit returns at once with a response id,
// poll reads it until it leaves queued/in_progress. store=true keeps the response past the
// ~10 minute window that background responses otherwise get.

const RESPONSES_URL = "https://api.openai.com/v1/responses";

export interface SubmitRequest {
  model: string;
  instructions: string;
  input: string;
  effort: string;
  /** Caps reasoning + visible output, so a runaway response fails fast instead of running to the model limit. */
  maxOutputTokens: number;
  schemaName: string;
  schema: Record<string, unknown>;
  tools?: Record<string, unknown>[];
  /** Caps the tool calls (web_search) of the whole response, which bounds its cost; the model answers without tools once it is reached. */
  maxToolCalls?: number;
  serviceTier: "flex" | "default";
  metadata: Record<string, string>;
}

export type PollResult =
  | { state: "running" }
  | { state: "completed"; model: string; text: string; usage: Record<string, unknown> | null }
  | { state: "failed"; cause: "provider" | "rejected"; error: string; model?: string; usage?: Record<string, unknown> | null };

export class ProviderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function headers(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function errorText(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: { message?: string } };
    return body.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function submitResponse(apiKey: string, req: SubmitRequest): Promise<string> {
  const send = (serviceTier: string) =>
    fetch(RESPONSES_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model: req.model,
        instructions: req.instructions,
        input: req.input,
        reasoning: { effort: req.effort },
        max_output_tokens: req.maxOutputTokens,
        tools: req.tools,
        max_tool_calls: req.maxToolCalls,
        text: { format: { type: "json_schema", name: req.schemaName, strict: true, schema: req.schema } },
        service_tier: serviceTier,
        background: true,
        store: true,
        metadata: req.metadata,
      }),
    });
  let res = await send(req.serviceTier);
  // Flex has best-effort capacity (429 when none is free) and is not offered for every model
  // (400 naming flex): the same request then goes to the default tier instead of failing.
  if (!res.ok && req.serviceTier === "flex") {
    const message = await errorText(res);
    if (res.status !== 429 && !(res.status === 400 && /flex/i.test(message))) throw new ProviderError(message, res.status);
    res = await send("default");
  }
  if (!res.ok) throw new ProviderError(await errorText(res), res.status);
  const body = await res.json() as { id?: string };
  if (!body.id) throw new ProviderError("response without id", res.status);
  return body.id;
}

interface ResponseBody {
  status?: string;
  model?: string;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: Record<string, unknown>;
  /** Tier that actually served the response; flex is billed at a lower rate. */
  service_tier?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
}

/** An incomplete or failed response can still have consumed tokens, so its cost is kept. */
function billed(body: ResponseBody): { model?: string; usage?: Record<string, unknown> } {
  const usage = usageOf(body);
  return { ...(body.model ? { model: body.model } : {}), ...(usage ? { usage } : {}) };
}

/**
 * Usage with the serving tier and the number of web_search calls (every action: search, open_page,
 * find_in_page), so the cost of a generation can be priced from its record alone.
 */
function usageOf(body: ResponseBody): Record<string, unknown> | null {
  if (!body.usage) return null;
  const webSearchCalls = (body.output ?? []).filter((item) => item.type === "web_search_call").length;
  return { ...body.usage, ...(body.service_tier ? { service_tier: body.service_tier } : {}), web_search_calls: webSearchCalls };
}

export function readResponse(body: ResponseBody): PollResult {
  const status = body.status ?? "";
  if (status === "queued" || status === "in_progress") return { state: "running" };
  if (status === "completed") {
    const text = (body.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("");
    if (!body.model) return { state: "failed", cause: "provider", error: "completed response without model" };
    return { state: "completed", model: body.model, text, usage: usageOf(body) };
  }
  if (status === "incomplete") {
    // The output budget ran out: a verdict on the model's answer, so it counts as a rejected attempt.
    return { state: "failed", cause: "rejected", error: `incomplete: ${body.incomplete_details?.reason ?? "unknown"}`, ...billed(body) };
  }
  // failed / cancelled: the provider gave up on the request (server error, no flex capacity).
  return { state: "failed", cause: "provider", error: `${status || "unknown status"}: ${body.error?.message ?? "no error message"}`, ...billed(body) };
}

/** Returns null when the provider could not be reached; the next tick polls again. */
export async function pollResponse(apiKey: string, id: string): Promise<PollResult | null> {
  const res = await fetch(`${RESPONSES_URL}/${encodeURIComponent(id)}`, { headers: headers(apiKey) });
  if (res.status === 404) return { state: "failed", cause: "provider", error: "response not found at provider" };
  if (res.status === 429 || res.status >= 500) return null;
  if (!res.ok) return { state: "failed", cause: "provider", error: await errorText(res) };
  return readResponse(await res.json() as ResponseBody);
}

/**
 * Cancels a background response that is still waiting. A confirmed cancel is a provider failure with the
 * given reason (and the usage it consumed); a response that finished meanwhile is read as usual, so its
 * result is not lost. Null when the provider refused or could not be reached; the next poll decides.
 */
export async function cancelResponse(apiKey: string, id: string, reason: string): Promise<PollResult | null> {
  const res = await fetch(`${RESPONSES_URL}/${encodeURIComponent(id)}/cancel`, { method: "POST", headers: headers(apiKey) });
  if (!res.ok) return null;
  const body = await res.json() as ResponseBody;
  return body.status === "cancelled" ? { state: "failed", cause: "provider", error: reason, ...billed(body) } : readResponse(body);
}
