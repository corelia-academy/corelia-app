type CaptionTrack = "manual" | "auto";

export interface CaptionCue {
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface CaptionWindow {
  start_seconds: number;
  end_seconds: number;
  cue_count: number;
  cue_text_sha256: string;
  excerpt: string;
}

export interface CaptionOutlineSegment {
  start_seconds: number;
  end_seconds: number;
  text: string;
}

export interface CaptionOutlineResult {
  ok: boolean;
  video_id: string;
  duration_seconds?: number;
  duration_source?: "metadata" | "last_cue";
  language?: string;
  track?: CaptionTrack;
  segments?: CaptionOutlineSegment[];
  truncated?: boolean;
  range?: {
    start_seconds: number;
    end_seconds: number;
  };
  reason?:
    | "yt_dlp_not_found"
    | "caption_download_failed"
    | "english_captions_unavailable"
    | "captions_do_not_match_query"
    | "range_has_no_captions"
    | "temporary_cleanup_failed";
}

export interface CaptionLookupResult {
  ok: boolean;
  video_id: string;
  language?: string;
  track?: CaptionTrack;
  matches?: CaptionWindow[];
  reason?:
    | "yt_dlp_not_found"
    | "caption_download_failed"
    | "english_captions_unavailable"
    | "captions_do_not_match_query"
    | "range_has_no_captions"
    | "temporary_cleanup_failed";
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);
const MAX_MATCHES = 3;
const MAX_WINDOW_SECONDS = 45;
const MAX_EXCERPT_CHARS = 280;
export const MAX_OUTLINE_DURATION_SECONDS = 720;
export const MAX_OUTLINE_SEGMENTS = 30;
export const MAX_OUTLINE_CHARS = 10_000;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "been",
  "before",
  "being",
  "between",
  "but",
  "can",
  "could",
  "does",
  "during",
  "each",
  "for",
  "from",
  "had",
  "has",
  "have",
  "into",
  "its",
  "lesson",
  "more",
  "most",
  "not",
  "only",
  "other",
  "our",
  "out",
  "over",
  "same",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "use",
  "used",
  "using",
  "very",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

function parseTime(value: string): number | null {
  const match = /^(?:(\d{2,}):)?(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number((match[4] ?? "").padEnd(3, "0"));
  if (minutes > 59 || seconds > 59) return null;
  return ((hours * 3600 + minutes * 60 + seconds) * 1000) + milliseconds;
}

function cleanCueText(lines: string[]): string {
  return lines.join(" ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse VTT cues without retaining style, speaker, or formatting markup. */
export function parseWebVtt(input: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (const block of input.replace(/^\uFEFF/, "").split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(
      Boolean,
    );
    const timeIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeIndex < 0) continue;
    const [startText, endAndSettings = ""] = lines[timeIndex].split("-->", 2);
    const endText = endAndSettings.trim().split(/\s+/, 1)[0];
    const startMs = parseTime(startText);
    const endMs = parseTime(endText);
    const text = cleanCueText(lines.slice(timeIndex + 1));
    if (
      startMs === null || endMs === null || endMs <= startMs ||
      endMs - startMs > MAX_WINDOW_SECONDS * 1000 || !text
    ) continue;
    cues.push({ start_ms: startMs, end_ms: endMs, text });
  }
  return cues;
}

function tokens(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .filter((token) => !STOP_WORDS.has(token)));
}

function excerpt(text: string): string {
  const chars = Array.from(text);
  return chars.length <= MAX_EXCERPT_CHARS
    ? text
    : `${chars.slice(0, MAX_EXCERPT_CHARS).join("").trimEnd()}…`;
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function windowFor(cues: CaptionCue[], seedIndex: number): CaptionCue[] {
  let from = Math.max(0, seedIndex - 2);
  let to = Math.min(cues.length - 1, seedIndex + 4);
  while (
    from < seedIndex &&
    cues[to].end_ms - cues[from].start_ms > MAX_WINDOW_SECONDS * 1000
  ) from++;
  while (
    to > seedIndex &&
    cues[to].end_ms - cues[from].start_ms > MAX_WINDOW_SECONDS * 1000
  ) to--;
  return cues.slice(from, to + 1);
}

/** Return up to three short, time-coded windows with lexical overlap against a lesson query. */
export async function findCaptionWindows(
  cues: CaptionCue[],
  query: string,
): Promise<CaptionWindow[]> {
  const queryTokens = tokens(query);
  if (cues.length === 0 || queryTokens.size === 0) return [];

  const candidates = new Map<string, { cues: CaptionCue[]; score: number }>();
  cues.forEach((cue, index) => {
    const selected = windowFor(cues, index);
    const selectedTokens = tokens(selected.map((item) => item.text).join(" "));
    const score = [...queryTokens].filter((token) =>
      selectedTokens.has(token)
    ).length;
    if (score === 0) return;
    const start = Math.floor(selected[0].start_ms / 1000);
    const end = Math.ceil(selected[selected.length - 1].end_ms / 1000);
    const key = `${start}:${end}`;
    const existing = candidates.get(key);
    if (!existing || score > existing.score) {
      candidates.set(key, {
        cues: selected,
        score,
      });
    }
  });

  const ranked = [...candidates.values()].sort((a, b) =>
    b.score - a.score || a.cues[0].start_ms - b.cues[0].start_ms
  );
  const selected: typeof ranked = [];
  for (const candidate of ranked) {
    const first = candidate.cues[0].start_ms;
    const last = candidate.cues[candidate.cues.length - 1].end_ms;
    const overlaps = selected.some((other) => {
      const otherFirst = other.cues[0].start_ms;
      const otherLast = other.cues[other.cues.length - 1].end_ms;
      return Math.min(last, otherLast) - Math.max(first, otherFirst) > 0;
    });
    if (overlaps) continue;
    selected.push(candidate);
    if (selected.length === MAX_MATCHES) break;
  }

  return Promise.all(selected.map(({ cues: window }) => describeWindow(window)));
}

/** The evidence record for a run of cues: one hashing path for matched windows and explicit ranges. */
async function describeWindow(window: CaptionCue[]): Promise<CaptionWindow> {
  const normalizedCues = window.map((cue) =>
    `${cue.start_ms}-${cue.end_ms}:${cue.text}`
  ).join("\n");
  return {
    start_seconds: Math.floor(window[0].start_ms / 1000),
    end_seconds: Math.ceil(window[window.length - 1].end_ms / 1000),
    cue_count: window.length,
    cue_text_sha256: await sha256(normalizedCues),
    excerpt: excerpt(window.map((cue) => cue.text).join(" ")),
  };
}

/**
 * Evidence for a playback range chosen by reading the transcript (a teaching segment longer than one matched window):
 * the cues that lie fully inside [startSeconds, endSeconds]. Returns null when the range holds no cue. Anyone can
 * re-run it with the same range and get the same start, end, cue_count and cue_text_sha256.
 */
export async function captionWindowForRange(
  cues: CaptionCue[],
  startSeconds: number,
  endSeconds: number,
): Promise<CaptionWindow | null> {
  const inside = cues.filter((cue) =>
    cue.start_ms >= startSeconds * 1000 && cue.end_ms <= endSeconds * 1000
  );
  return inside.length === 0 ? null : await describeWindow(inside);
}

/**
 * Groups raw caption cues into coherent teaching segments covering the requested range (or the whole video).
 * Applies size bounds (MAX_OUTLINE_DURATION_SECONDS, MAX_OUTLINE_SEGMENTS, MAX_OUTLINE_CHARS) and returns
 * `truncated: true` with the covered range when the content exceeds the ceiling.
 */
export function buildCaptionOutline(
  cues: CaptionCue[],
  range?: { start: number; end: number },
): {
  segments: CaptionOutlineSegment[];
  truncated: boolean;
  range: { start_seconds: number; end_seconds: number };
} | null {
  const filteredCues = range
    ? cues.filter((cue) =>
      cue.start_ms >= range.start * 1000 && cue.end_ms <= range.end * 1000
    )
    : cues;

  if (filteredCues.length === 0) return null;

  const segments: CaptionOutlineSegment[] = [];
  let currentSegmentCues: CaptionCue[] = [];
  let truncated = false;
  let totalChars = 0;

  for (let i = 0; i < filteredCues.length; i++) {
    const cue = filteredCues[i];
    currentSegmentCues.push(cue);

    const segStartMs = currentSegmentCues[0].start_ms;
    const segEndMs = cue.end_ms;
    const segDurationMs = segEndMs - segStartMs;
    const isSentenceEnd = /[.!?]$/.test(cue.text.trim());
    const isLastCue = i === filteredCues.length - 1;

    if (
      isLastCue ||
      segDurationMs >= 45_000 ||
      (segDurationMs >= 20_000 && isSentenceEnd) ||
      segDurationMs >= 35_000
    ) {
      const segStartSec = Math.floor(currentSegmentCues[0].start_ms / 1000);
      const segEndSec = Math.ceil(currentSegmentCues[currentSegmentCues.length - 1].end_ms / 1000);
      const text = currentSegmentCues.map((c) => c.text).join(" ");
      segments.push({
        start_seconds: segStartSec,
        end_seconds: segEndSec,
        text,
      });
      totalChars += text.length;
      currentSegmentCues = [];

      const coveredDuration = segEndSec - segments[0].start_seconds;
      if (!isLastCue) {
        if (
          coveredDuration >= MAX_OUTLINE_DURATION_SECONDS ||
          segments.length >= MAX_OUTLINE_SEGMENTS ||
          totalChars >= MAX_OUTLINE_CHARS
        ) {
          truncated = true;
          break;
        }
      }
    }
  }

  if (currentSegmentCues.length > 0 && !truncated) {
    const segStartSec = Math.floor(currentSegmentCues[0].start_ms / 1000);
    const segEndSec = Math.ceil(currentSegmentCues[currentSegmentCues.length - 1].end_ms / 1000);
    const text = currentSegmentCues.map((c) => c.text).join(" ");
    segments.push({
      start_seconds: segStartSec,
      end_seconds: segEndSec,
      text,
    });
  }

  const outlineRange = {
    start_seconds: segments[0].start_seconds,
    end_seconds: segments[segments.length - 1].end_seconds,
  };

  return {
    segments,
    truncated,
    range: outlineRange,
  };
}

export function getYoutubeVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
  ) return null;
  const pathParts = url.pathname.split("/").filter(Boolean);
  const id = url.hostname.toLowerCase() === "youtu.be"
    ? pathParts[0]
    : url.searchParams.get("v") ??
      (pathParts[0] === "shorts" || pathParts[0] === "embed"
        ? pathParts[1]
        : null);
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

async function runYtDlp(args: string[]): Promise<{ code: number }> {
  const result = await new Deno.Command("yt-dlp", {
    args,
    stdin: "null",
    stdout: "null",
    stderr: "null",
  }).output();
  return { code: result.code };
}

async function vttFiles(directory: string, videoId: string): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    if (
      entry.isFile && entry.name.toLowerCase().endsWith(".vtt") &&
      entry.name.startsWith(`${videoId}.`)
    ) {
      files.push(
        `${directory}${Deno.build.os === "windows" ? "\\" : "/"}${entry.name}`,
      );
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

export function languageFromCaptionFilename(
  path: string,
  videoId: string,
): string {
  const filename = path.split(/[\\/]/).at(-1) ?? "";
  const encodedLanguage = filename.slice(videoId.length + 1, -4);
  const language = encodedLanguage.split(".").at(-1) ?? encodedLanguage;
  return /^en(?:-[A-Za-z0-9]+)*$/i.test(language) ? language : encodedLanguage;
}

async function downloadTrack(
  videoId: string,
  url: string,
  track: CaptionTrack,
  directory: string,
) {
  await Deno.mkdir(directory, { recursive: true });
  const outputTemplate = `${directory}${
    Deno.build.os === "windows" ? "\\" : "/"
  }%(id)s.%(language)s.%(ext)s`;
  const trackFlag = track === "manual" ? "--write-subs" : "--write-auto-subs";
  const result = await runYtDlp([
    "--no-playlist",
    "--skip-download",
    "--sub-langs",
    "en,en-US,en-GB",
    "--sub-format",
    "vtt",
    trackFlag,
    "--output",
    outputTemplate,
    url,
  ]);
  const files = await vttFiles(directory, videoId);
  return { ...result, files };
}

export async function lookupYoutubeCaptionWindows(
  url: string,
  query: string,
  range?: { start: number; end: number },
): Promise<CaptionLookupResult> {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) {
    return { ok: false, video_id: "", reason: "caption_download_failed" };
  }

  let tempDir: string | null = null;
  let response: CaptionLookupResult | undefined;
  let cleanupFailed = false;
  try {
    tempDir = await Deno.makeTempDir({ prefix: "corelia-youtube-captions-" });
    let chosen:
      | { file: string; track: CaptionTrack; cues: CaptionCue[] }
      | undefined;
    let downloadFailure = false;
    for (const track of ["manual", "auto"] as const) {
      const directory = `${tempDir}${
        Deno.build.os === "windows" ? "\\" : "/"
      }${track}`;
      let result: Awaited<ReturnType<typeof downloadTrack>>;
      try {
        result = await downloadTrack(videoId, url, track, directory);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          response = {
            ok: false,
            video_id: videoId,
            reason: "yt_dlp_not_found",
          };
          break;
        }
        throw error;
      }
      if (result.files.length > 0) {
        const preferred = result.files.find((file) =>
          languageFromCaptionFilename(file, videoId).toLowerCase() === "en"
        ) ?? result.files[0];
        const cues = parseWebVtt(await Deno.readTextFile(preferred));
        if (cues.length > 0) {
          chosen = { file: preferred, track, cues };
          break;
        }
      }
      downloadFailure ||= result.code !== 0;
    }

    if (!response && !chosen) {
      response = {
        ok: false,
        video_id: videoId,
        reason: downloadFailure
          ? "caption_download_failed"
          : "english_captions_unavailable",
      };
    } else if (chosen) {
      const language = languageFromCaptionFilename(chosen.file, videoId);
      if (range) {
        const window = await captionWindowForRange(chosen.cues, range.start, range.end);
        response = {
          ok: true,
          video_id: videoId,
          language,
          track: chosen.track,
          matches: window ? [window] : [],
          ...(window ? {} : { reason: "range_has_no_captions" as const }),
        };
      } else {
        const matches = await findCaptionWindows(chosen.cues, query);
        response = {
          ok: true,
          video_id: videoId,
          language,
          track: chosen.track,
          matches,
          ...(matches.length === 0
            ? { reason: "captions_do_not_match_query" as const }
            : {}),
        };
      }
    }
  } catch (error) {
    response = {
      ok: false,
      video_id: videoId,
      reason: error instanceof Error && error.message.includes("yt-dlp")
        ? "yt_dlp_not_found"
        : "caption_download_failed",
    };
  } finally {
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        cleanupFailed = true;
      }
    }
  }

  if (cleanupFailed) {
    return { ok: false, video_id: videoId, reason: "temporary_cleanup_failed" };
  }
  return response ??
    { ok: false, video_id: videoId, reason: "caption_download_failed" };
}

export async function fetchVideoDuration(url: string): Promise<number | null> {
  try {
    const result = await new Deno.Command("yt-dlp", {
      args: ["--no-playlist", "--skip-download", "--print", "%(duration)s", url],
      stdin: "null",
      stdout: "piped",
      stderr: "null",
    }).output();
    if (result.code !== 0) return null;
    const text = new TextDecoder().decode(result.stdout).trim();
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
  } catch {
    return null;
  }
}

export async function lookupYoutubeCaptionOutline(
  url: string,
  range?: { start: number; end: number },
): Promise<CaptionOutlineResult> {
  const videoId = getYoutubeVideoId(url);
  if (!videoId) {
    return { ok: false, video_id: "", reason: "caption_download_failed" };
  }

  let tempDir: string | null = null;
  let response: CaptionOutlineResult | undefined;
  let cleanupFailed = false;
  try {
    tempDir = await Deno.makeTempDir({ prefix: "corelia-youtube-captions-" });
    let chosen:
      | { file: string; track: CaptionTrack; cues: CaptionCue[] }
      | undefined;
    let downloadFailure = false;
    for (const track of ["manual", "auto"] as const) {
      const directory = `${tempDir}${
        Deno.build.os === "windows" ? "\\" : "/"
      }${track}`;
      let result: Awaited<ReturnType<typeof downloadTrack>>;
      try {
        result = await downloadTrack(videoId, url, track, directory);
      } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
          response = {
            ok: false,
            video_id: videoId,
            reason: "yt_dlp_not_found",
          };
          break;
        }
        throw error;
      }
      if (result.files.length > 0) {
        const preferred = result.files.find((file) =>
          languageFromCaptionFilename(file, videoId).toLowerCase() === "en"
        ) ?? result.files[0];
        const cues = parseWebVtt(await Deno.readTextFile(preferred));
        if (cues.length > 0) {
          chosen = { file: preferred, track, cues };
          break;
        }
      }
      downloadFailure ||= result.code !== 0;
    }

    if (!response && !chosen) {
      response = {
        ok: false,
        video_id: videoId,
        reason: downloadFailure
          ? "caption_download_failed"
          : "english_captions_unavailable",
      };
    } else if (chosen) {
      const language = languageFromCaptionFilename(chosen.file, videoId);
      const metadataDuration = await fetchVideoDuration(url);
      const lastCueSeconds = chosen.cues.length > 0
        ? Math.ceil(chosen.cues[chosen.cues.length - 1].end_ms / 1000)
        : 0;
      const duration_seconds = metadataDuration ?? lastCueSeconds;
      const duration_source = metadataDuration ? "metadata" as const : "last_cue" as const;

      const outline = buildCaptionOutline(chosen.cues, range);
      if (!outline) {
        response = {
          ok: true,
          video_id: videoId,
          language,
          track: chosen.track,
          duration_seconds,
          duration_source,
          segments: [],
          truncated: false,
          reason: "range_has_no_captions",
        };
      } else {
        response = {
          ok: true,
          video_id: videoId,
          language,
          track: chosen.track,
          duration_seconds,
          duration_source,
          segments: outline.segments,
          truncated: outline.truncated,
          range: outline.range,
        };
      }
    }
  } catch (error) {
    response = {
      ok: false,
      video_id: videoId,
      reason: error instanceof Error && error.message.includes("yt-dlp")
        ? "yt_dlp_not_found"
        : "caption_download_failed",
    };
  } finally {
    if (tempDir) {
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        cleanupFailed = true;
      }
    }
  }

  if (cleanupFailed) {
    return { ok: false, video_id: videoId, reason: "temporary_cleanup_failed" };
  }
  return response ??
    { ok: false, video_id: videoId, reason: "caption_download_failed" };
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

async function main(args: string[]) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "Usage: deno run -A --no-config scripts/studio/youtube-captions.ts --url <YouTube URL> --query <lesson title and outcomes>\n" +
        "       deno run -A --no-config scripts/studio/youtube-captions.ts --url <YouTube URL> --range <start>-<end>   (evidence for a segment chosen from the transcript)\n" +
        "       deno run -A --no-config scripts/studio/youtube-captions.ts --url <YouTube URL> --outline [--range <start>-<end>]   (read video outline and duration for research)",
    );
    return;
  }
  const outline = args.includes("--outline");
  const url = readOption(args, "--url");
  const query = readOption(args, "--query");
  const rangeText = readOption(args, "--range");
  const range = rangeText?.match(/^(\d+)-(\d+)$/);
  const rangeValue = range && Number(range[2]) > Number(range[1])
    ? { start: Number(range[1]), end: Number(range[2]) }
    : undefined;

  if (outline) {
    if (!url || (rangeText && !rangeValue)) {
      console.log(
        JSON.stringify({
          ok: false,
          video_id: "",
          reason: "usage: provide --url and --outline [--range <start>-<end>]",
        }),
      );
      return;
    }
    console.log(JSON.stringify(await lookupYoutubeCaptionOutline(url, rangeValue)));
    return;
  }

  if (!url || (rangeText ? !rangeValue : !query)) {
    console.log(
      JSON.stringify({
        ok: false,
        video_id: "",
        reason: "usage: provide --url and --query, or --url and --range <start>-<end>",
      }),
    );
    return;
  }
  console.log(JSON.stringify(await lookupYoutubeCaptionWindows(url, query ?? "", rangeValue)));
}

if (import.meta.main && typeof Deno !== "undefined") {
  await main(Deno.args);
}
