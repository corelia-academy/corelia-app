// Pure rules of the Studio MCP tools, kept apart from index.ts (which starts the server on import) so they can be tested.

import type { Acceptance } from "../corelia-api/studio/steps.ts";

// A2 must hand A3/A5 real video candidates, and web search alone rarely returns videos from the approved channels.
export const RESEARCH_VIDEO_INSTRUCTIONS = "Video candidates are required: submitting research with no valid video is rejected. For each topic, from the repository root run `deno run -A --no-config scripts/studio/youtube-search.ts --query \"<2-4 keywords of the topic>\"` (it needs yt-dlp). It searches only the approved allowed_channels and prints JSON candidates (url, title, channel). Open the chosen video's page so it is a source you have read (access = read, add it to sources), then list it in videos with that source_id in evidence_source_ids, channel exactly as printed, and a rank per topic. Only use videos the script returned; try another keyword query when a topic has none.";

/**
 * An accepted research result of an external coordinator must still carry at least one valid video: without
 * candidates A3 can only plan articles and quizzes. The server path searches the web itself and is not checked.
 */
export function requireResearchVideos(acceptance: Acceptance, output: unknown): Acceptance {
  if (!acceptance.ok) return acceptance;
  const kept = (acceptance.normalizedOutput ?? output) as { videos?: unknown } | null;
  if (Array.isArray(kept?.videos) && kept.videos.length > 0) return acceptance;
  return {
    ok: false,
    reason: `Research chưa có video ứng viên hợp lệ từ allowed_channels. ${acceptance.summary} ${RESEARCH_VIDEO_INSTRUCTIONS}`,
  };
}

/** Locales that already have translation generations but are missing from the locales a run is narrowed to. */
export function droppedTranslationLocales(usedLocales: readonly string[], chosen: readonly string[]): string[] {
  return [...new Set(usedLocales)].filter((locale) => !chosen.includes(locale));
}
