import { getYoutubeVideoId } from "@/types/courses";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export type YoutubeVideoMetadata = {
  videoId: string;
  durationSeconds: number;
  title?: string;
  description?: string;
};

/**
 * Parse ISO 8601 duration (PT1H2M10S, PT15M33S) to seconds.
 * @see https://developers.google.com/youtube/v3/docs/videos#contentDetails.duration
 */
function parseIso8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function resolveVideoId(videoIdOrUrl: string): string | null {
  return videoIdOrUrl.length === 11 && !videoIdOrUrl.includes("/")
    ? videoIdOrUrl
    : getYoutubeVideoId(videoIdOrUrl);
}

/**
 * snippet + contentDetails (duration + description for chapter parsing).
 */
export async function fetchYoutubeVideoMetadata(
  videoIdOrUrl: string,
): Promise<YoutubeVideoMetadata | null> {
  const videoId = resolveVideoId(videoIdOrUrl);
  if (!videoId || !YOUTUBE_API_KEY) return null;

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    const duration = item?.contentDetails?.duration;
    const durationSeconds = duration ? parseIso8601Duration(duration) : 0;
    if (!durationSeconds) return null;

    return {
      videoId,
      durationSeconds,
      title: item?.snippet?.title as string | undefined,
      description: (item?.snippet?.description as string | undefined) ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Lấy thời lượng (giây) của video YouTube qua Data API v3.
 * Cần bật YouTube Data API v3 và set VITE_YOUTUBE_API_KEY trong .env.
 * Trả về 0 nếu không có API key hoặc request lỗi.
 */
export async function getYoutubeVideoDuration(
  videoIdOrUrl: string,
): Promise<number> {
  const meta = await fetchYoutubeVideoMetadata(videoIdOrUrl);
  return meta?.durationSeconds ?? 0;
}
