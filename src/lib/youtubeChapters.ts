/**
 * Pure helpers for parsing YouTube-style timestamp chapters from video descriptions.
 */

export interface ParsedChapterStart {
  title: string;
  startSeconds: number;
}

export interface LessonSegmentFromYoutube {
  title: string;
  startSeconds: number;
  /** Exclusive upper bound preferred for embed `end`; use video end when last chapter */
  endSeconds: number;
}

/** Parse "MM:SS", "H:MM:SS", or "HH:MM:SS" into seconds. */
/** Hiển thị giây dưới dạng M:SS hoặc H:MM:SS (giống YouTube chapters). */
export function formatSecondsToTimestamp(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function parseTimestampLabelToSeconds(label: string): number | null {
  const s = label.trim();
  if (!s) return null;
  const parts = s.split(":").map((p) => parseInt(p.trim(), 10));
  if (parts.some((n) => Number.isNaN(n)) || parts.length < 2 || parts.length > 3) {
    return null;
  }
  if (parts.length === 2) {
    const [a, b] = parts;
    return a * 60 + b;
  }
  const [h, m, sec] = parts;
  return h * 3600 + m * 60 + sec;
}

/**
 * Extract chapter-like lines from a description (timestamp at line start + title).
 */
export function parseChaptersFromDescription(
  description: string,
  videoDurationSec: number,
): ParsedChapterStart[] {
  if (!description?.trim() || !(videoDurationSec > 0)) return [];

  const maxSec = Math.max(0, Math.floor(videoDurationSec));
  const seenStarts = new Set<number>();
  const raw: ParsedChapterStart[] = [];

  for (const line of description.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^((?:\d{1,3}:)?\d{1,3}:\d{2})\s+(.+)$/);
    if (!match) continue;
    const startSeconds = parseTimestampLabelToSeconds(match[1]);
    const title = (match[2] ?? "").trim();
    if (startSeconds == null || title.length === 0) continue;
    if (startSeconds < 0 || startSeconds > maxSec) continue;
    const rounded = Math.floor(startSeconds);
    if (seenStarts.has(rounded)) continue;
    seenStarts.add(rounded);
    raw.push({ title, startSeconds: rounded });
  }

  raw.sort((a, b) => a.startSeconds - b.startSeconds);
  return raw;
}

export function buildSegmentsFromChapterStarts(
  chapters: ParsedChapterStart[],
  videoDurationSec: number,
): LessonSegmentFromYoutube[] {
  const maxSec = Math.max(1, Math.floor(videoDurationSec));
  if (chapters.length === 0) return [];

  const sorted = [...chapters].sort((a, b) => a.startSeconds - b.startSeconds);
  const out: LessonSegmentFromYoutube[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const startSeconds = sorted[i].startSeconds;
    if (startSeconds >= maxSec) break;
    const nextStart =
      i + 1 < sorted.length ? sorted[i + 1].startSeconds : maxSec;
    const endSeconds = Math.min(Math.max(nextStart, startSeconds + 1), maxSec);
    if (endSeconds <= startSeconds) continue;
    out.push({
      title: sorted[i].title.trim() || `Part ${i + 1}`,
      startSeconds,
      endSeconds,
    });
  }

  return out;
}
