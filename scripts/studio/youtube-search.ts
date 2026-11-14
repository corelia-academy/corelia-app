// Finds YouTube videos on the approved channels (supabase/functions/corelia-api/studio/channels.ts) for one
// research topic, so an external CLI coordinator can fill A2's `videos` with videos it actually saw.
// Usage: deno run -A --no-config scripts/studio/youtube-search.ts --query "<topic and outcome>" [--channels @a,@b] [--per-channel 3]
import { ALLOWED_CHANNELS } from "../../supabase/functions/corelia-api/studio/channels.ts";

export interface VideoCandidate {
  video_id: string;
  url: string;
  title: string;
  channel: string;
  handle: string;
  duration_seconds: number | null;
}

export interface SearchResult {
  ok: boolean;
  query: string;
  candidates: VideoCandidate[];
  failures: { handle: string; reason: string }[];
  reason?: "yt_dlp_not_found" | "usage";
}

const CHANNEL_TIMEOUT_MS = 60_000;
const CONCURRENCY = 4;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** One `yt-dlp --flat-playlist --dump-json` line of a channel search, or null when it is not a usable video. */
export function parseSearchLine(line: string, channel: { name: string; handle: string }): VideoCandidate | null {
  let entry: Record<string, unknown>;
  try {
    entry = JSON.parse(line);
  } catch {
    return null;
  }
  const id = typeof entry.id === "string" ? entry.id : "";
  const title = typeof entry.title === "string" ? entry.title.trim() : "";
  if (!VIDEO_ID.test(id) || !title) return null;
  const duration = typeof entry.duration === "number" && entry.duration > 0 ? Math.round(entry.duration) : null;
  return {
    video_id: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    title,
    channel: channel.name,
    handle: channel.handle,
    duration_seconds: duration,
  };
}

async function searchChannel(
  channel: { name: string; handle: string },
  query: string,
  perChannel: number,
): Promise<{ candidates: VideoCandidate[]; failure?: string }> {
  const url = `https://www.youtube.com/${channel.handle}/search?query=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHANNEL_TIMEOUT_MS);
  try {
    const result = await new Deno.Command("yt-dlp", {
      args: ["--flat-playlist", "--dump-json", "--no-warnings", "--playlist-end", String(perChannel), url],
      stdin: "null",
      stdout: "piped",
      stderr: "null",
      signal: controller.signal,
    }).output();
    if (result.code !== 0) return { candidates: [], failure: `yt_dlp_exit_${result.code}` };
    const lines = new TextDecoder().decode(result.stdout).split("\n").filter((line) => line.trim());
    return { candidates: lines.flatMap((line) => parseSearchLine(line, channel) ?? []) };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) throw error;
    return { candidates: [], failure: controller.signal.aborted ? "timeout" : "search_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchApprovedChannels(query: string, handles: string[] | null, perChannel: number): Promise<SearchResult> {
  const wanted = handles ? new Set(handles.map((handle) => handle.toLowerCase())) : null;
  const channels = ALLOWED_CHANNELS.filter((channel) => !wanted || wanted.has(channel.handle));
  const candidates: VideoCandidate[] = [];
  const failures: SearchResult["failures"] = [];
  let next = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, channels.length) }, async () => {
      while (next < channels.length) {
        const channel = channels[next++];
        const found = await searchChannel(channel, query, perChannel);
        candidates.push(...found.candidates);
        if (found.failure) failures.push({ handle: channel.handle, reason: found.failure });
      }
    }));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return { ok: false, query, candidates: [], failures: [], reason: "yt_dlp_not_found" };
    throw error;
  }
  const seen = new Set<string>();
  const unique = candidates.filter((video) => !seen.has(video.video_id) && seen.add(video.video_id));
  return { ok: true, query, candidates: unique, failures };
}

const FILLER_WORDS = new Set(["about", "after", "and", "are", "beginners", "beginner", "explain", "for", "from", "how", "into", "that", "the", "their", "this", "what", "when", "which", "with", "your"]);

/** YouTube channel search matches short keyword queries; a full sentence usually returns nothing. */
export function keywordQuery(query: string, maxWords = 3): string {
  const words = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2 && !FILLER_WORDS.has(word));
  return [...new Set(words)].slice(0, maxWords).join(" ");
}

/** Searches the full query first; when no approved channel has a match, retries with its leading keywords. */
export async function searchWithFallback(query: string, handles: string[] | null, perChannel: number): Promise<SearchResult & { query_used: string }> {
  const first = await searchApprovedChannels(query, handles, perChannel);
  const fallback = keywordQuery(query);
  if (!first.ok || first.candidates.length > 0 || !fallback || fallback === query.toLowerCase()) return { ...first, query_used: query };
  const second = await searchApprovedChannels(fallback, handles, perChannel);
  return { ...second, query_used: fallback };
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

async function main(args: string[]) {
  const query = readOption(args, "--query")?.trim();
  if (args.includes("--help") || args.includes("-h") || !query) {
    console.log(
      JSON.stringify({ ok: false, query: query ?? "", candidates: [], failures: [], reason: "usage" }),
    );
    return;
  }
  const channels = readOption(args, "--channels")?.split(",").map((handle) => handle.trim()).filter(Boolean) ?? null;
  const perChannel = Math.min(Math.max(Number.parseInt(readOption(args, "--per-channel") ?? "3", 10) || 3, 1), 10);
  console.log(JSON.stringify(await searchWithFallback(query, channels, perChannel)));
}

if (import.meta.main && typeof Deno !== "undefined") {
  await main(Deno.args);
}
