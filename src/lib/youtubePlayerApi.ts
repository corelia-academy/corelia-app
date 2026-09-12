export interface YoutubePlayer { destroy(): void }
export interface YoutubePlayerApi {
  Player: new (frame: HTMLIFrameElement, options: { events: { onReady(): void; onError(): void } }) => YoutubePlayer;
}
type YoutubeWindow = Window & { YT?: YoutubePlayerApi; onYouTubeIframeAPIReady?: () => void };
let pending: Promise<YoutubePlayerApi> | null = null;

/** One API load shared by previews/learners; a failed load can be retried. */
export function loadYoutubePlayerApi(): Promise<YoutubePlayerApi> {
  const target = window as YoutubeWindow;
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (pending) return pending;
  pending = new Promise<YoutubePlayerApi>((resolve, reject) => {
    const script = document.createElement("script");
    const previous = target.onYouTubeIframeAPIReady;
    const cleanup = () => {
      clearTimeout(timer);
      script.onerror = null;
      if (target.onYouTubeIframeAPIReady === ready) target.onYouTubeIframeAPIReady = previous;
    };
    const fail = () => { cleanup(); script.remove(); reject(new Error("YOUTUBE_API_UNAVAILABLE")); };
    const ready = () => {
      cleanup();
      if (target.YT?.Player) resolve(target.YT); else reject(new Error("YOUTUBE_API_UNAVAILABLE"));
      previous?.();
    };
    const timer = setTimeout(fail, 20_000);
    target.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => { pending = null; throw error; });
  return pending;
}
