import { getYoutubeVideoId } from "@/types/courses";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

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

/**
 * Lấy thời lượng (giây) của video YouTube qua Data API v3.
 * Cần bật YouTube Data API v3 và set VITE_YOUTUBE_API_KEY trong .env.
 * Trả về 0 nếu không có API key hoặc request lỗi.
 */
export async function getYoutubeVideoDuration(
  videoIdOrUrl: string
): Promise<number> {
  const videoId = videoIdOrUrl.length === 11 && !videoIdOrUrl.includes("/")
    ? videoIdOrUrl
    : getYoutubeVideoId(videoIdOrUrl);
  if (!videoId || !YOUTUBE_API_KEY) return 0;

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "contentDetails");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", YOUTUBE_API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return 0;
    const data = await res.json();
    const duration = data?.items?.[0]?.contentDetails?.duration;
    return duration ? parseIso8601Duration(duration) : 0;
  } catch {
    return 0;
  }
}
