// Calls studio.tick on a loop so Studio runs advance on a local stack, where no scheduler exists.
// The secret is read from supabase/functions/.env at startup and is never logged.
//   node scripts/studio/tick.mjs [--interval <seconds>] [--url <functions url>]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { interval: { type: "string", default: "15" }, url: { type: "string" } } });
const intervalMs = Number(values.interval) * 1000;
if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
  console.error("--interval must be at least 1 second");
  process.exit(1);
}
const baseUrl = (values.url ?? process.env.STUDIO_FUNCTIONS_URL ?? "http://127.0.0.1:54321/functions/v1").replace(/\/+$/, "");

function readSecret() {
  const text = readFileSync(resolve(process.cwd(), "supabase", "functions", ".env"), "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith("CORELIA_STUDIO_CRON_SECRET="));
  const secret = line?.slice(line.indexOf("=") + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  if (!secret) throw new Error("CORELIA_STUDIO_CRON_SECRET missing in supabase/functions/.env");
  return secret;
}

const secret = readSecret();
const abort = new AbortController();
let timer;
let stopped = false;

async function tick() {
  const at = new Date().toISOString().slice(11, 19);
  try {
    const res = await fetch(`${baseUrl}/corelia-api?op=studio.tick`, {
      method: "POST",
      headers: { "x-corelia-studio-cron-secret": secret },
      signal: abort.signal,
    });
    if (!res.ok) {
      console.log(`${at} HTTP ${res.status}`);
      return;
    }
    const body = await res.json();
    const detail = (body.results ?? []).map((r) => `${r.run_id.slice(0, 8)} ${r.step ?? "-"}:${r.action ?? r.error}`).join(", ");
    console.log(`${at} processed=${body.processed}${detail ? ` ${detail}` : ""}`);
  } catch (e) {
    if (!stopped) console.log(`${at} ${e instanceof Error ? e.message : e}`);
  }
}

// Sequential: the next tick is scheduled after the previous one returns, so ticks never overlap.
async function loop() {
  await tick();
  if (!stopped) timer = setTimeout(loop, intervalMs);
}

function stop() {
  stopped = true;
  clearTimeout(timer);
  abort.abort();
  console.log("stopped");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log(`studio tick every ${values.interval}s -> ${baseUrl}`);
loop();
