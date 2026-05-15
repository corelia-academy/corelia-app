#!/usr/bin/env node

const endpoint =
  process.env.CORA_AI_TEST_URL?.trim() ||
  "http://127.0.0.1:54321/functions/v1/ai-tutor";
const accessToken = process.env.CORA_AI_TEST_ACCESS_TOKEN?.trim() || "";
const apikey =
  process.env.CORA_AI_TEST_ANON_KEY?.trim() ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
  "";
const assistantContext = process.env.CORA_AI_TEST_CONTEXT?.trim() || "home";
const lessonId = process.env.CORA_AI_TEST_LESSON_ID?.trim() || "";
const message =
  process.env.CORA_AI_TEST_MESSAGE?.trim() ||
  "Tóm tắt giúp mình nên học gì tiếp theo trong tuần này.";

if (!accessToken) {
  console.error(
    [
      "Missing CORA_AI_TEST_ACCESS_TOKEN.",
      "Example:",
      "CORA_AI_TEST_ACCESS_TOKEN=<supabase_access_token> pnpm cora:test:stream",
    ].join("\n"),
  );
  process.exit(1);
}

const payload = {
  message,
  assistantContext,
  lessonId: lessonId || null,
  stream: true,
};

function logBlock(title, value) {
  process.stdout.write(`\n[${title}]\n${value}\n`);
}

function formatQuota(quota) {
  if (!quota || typeof quota !== "object") return "n/a";
  const monthly = `${quota.monthlyUsed ?? "?"}/${quota.monthlyLimit ?? "∞"}`;
  const daily = `${quota.dailyUsed ?? "?"}/${quota.dailySoftCap ?? "∞"}`;
  return `tier=${quota.tier ?? "?"}, monthly=${monthly}, daily=${daily}, throttled=${quota.throttled === true}, haikuOnly=${quota.haikuOnly === true}`;
}

function formatSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) return "none";
  return sources
    .map((source, index) => {
      if (!source || typeof source !== "object") return `${index + 1}. unknown`;
      const topic = source.topic ?? "unknown";
      const subtopic = source.subtopic ? ` / ${source.subtopic}` : "";
      const category = source.category ? ` [${source.category}]` : "";
      const track = source.track ? ` <${source.track}>` : "";
      return `${index + 1}. ${topic}${subtopic}${category}${track}`;
    })
    .join("\n");
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(apikey ? { apikey } : {}),
  },
  body: JSON.stringify(payload),
});

logBlock("request", JSON.stringify({ endpoint, payload }, null, 2));
logBlock("status", `${response.status} ${response.statusText}`);

const contentType = response.headers.get("content-type") || "";
if (!response.ok) {
  const errorText = await response.text().catch(() => "");
  logBlock("error", errorText || "Unknown error");
  process.exit(1);
}

if (!contentType.includes("text/event-stream")) {
  const body = await response.text().catch(() => "");
  logBlock("response", body || "No response body");
  process.exit(0);
}

if (!response.body) {
  logBlock("error", "Readable stream missing from response.");
  process.exit(1);
}

const decoder = new TextDecoder();
let buffer = "";

for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });

  while (true) {
    const boundary = buffer.indexOf("\n\n");
    if (boundary === -1) break;
    const rawEvent = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);

    let eventName = "message";
    let data = "";
    for (const line of rawEvent.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (!data) continue;

    if (eventName === "delta") {
      try {
        const parsed = JSON.parse(data);
        process.stdout.write(parsed.text || "");
      } catch {
        process.stdout.write(data);
      }
      continue;
    }

    try {
      const parsed = JSON.parse(data);
      if (eventName === "meta") {
        logBlock(
          eventName,
          [
            `sessionId: ${parsed.sessionId ?? "n/a"}`,
            `quota: ${formatQuota(parsed.quota)}`,
            `placeholderId: ${parsed.placeholderId ?? "n/a"}`,
            `sources:\n${formatSources(parsed.sources)}`,
          ].join("\n"),
        );
        continue;
      }
      if (eventName === "done") {
        logBlock(
          eventName,
          [
            `sessionId: ${parsed.sessionId ?? "n/a"}`,
            `provider: ${parsed.provider ?? "n/a"}`,
            `model: ${parsed.model ?? "n/a"}`,
            `createdAt: ${parsed.createdAt ?? "n/a"}`,
            `quota: ${formatQuota(parsed.quota)}`,
            `sources:\n${formatSources(parsed.sources)}`,
          ].join("\n"),
        );
        continue;
      }
      logBlock(eventName, JSON.stringify(parsed, null, 2));
    } catch {
      logBlock(eventName, data);
    }
  }
}

process.stdout.write("\n");
