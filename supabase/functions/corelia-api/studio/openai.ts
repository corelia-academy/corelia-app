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
  metadata: Record<string, string>;
}

export type PollResult =
  | { state: "running" }
  | { state: "completed"; model: string; text: string; usage: Record<string, unknown> | null }
  | { state: "failed"; error: string; model?: string; usage?: Record<string, unknown> | null };

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
  const res = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      model: req.model,
      instructions: req.instructions,
      input: req.input,
      reasoning: { effort: req.effort },
      max_output_tokens: req.maxOutputTokens,
      tools: req.tools,
      text: { format: { type: "json_schema", name: req.schemaName, strict: true, schema: req.schema } },
      background: true,
      store: true,
      metadata: req.metadata,
    }),
  });
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
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
}

/** An incomplete or failed response can still have consumed tokens, so its cost is kept. */
function billed(body: ResponseBody): { model?: string; usage?: Record<string, unknown> } {
  return { ...(body.model ? { model: body.model } : {}), ...(body.usage ? { usage: body.usage } : {}) };
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
    if (!body.model) return { state: "failed", error: "completed response without model" };
    return { state: "completed", model: body.model, text, usage: body.usage ?? null };
  }
  if (status === "incomplete") {
    return { state: "failed", error: `incomplete: ${body.incomplete_details?.reason ?? "unknown"}`, ...billed(body) };
  }
  return { state: "failed", error: `${status || "unknown status"}: ${body.error?.message ?? "no error message"}`, ...billed(body) };
}

/** Returns null when the provider could not be reached; the next tick polls again. */
export async function pollResponse(apiKey: string, id: string): Promise<PollResult | null> {
  const res = await fetch(`${RESPONSES_URL}/${encodeURIComponent(id)}`, { headers: headers(apiKey) });
  if (res.status === 404) return { state: "failed", error: "response not found at provider" };
  if (res.status === 429 || res.status >= 500) return null;
  if (!res.ok) return { state: "failed", error: await errorText(res) };
  return readResponse(await res.json() as ResponseBody);
}
