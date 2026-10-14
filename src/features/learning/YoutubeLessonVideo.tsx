import { useEffect, useRef, useState } from "react";
import { loadYoutubePlayerApi, type YoutubePlayer } from "@/lib/youtubePlayerApi";
import { useLearningTranslation } from "./useLearningTranslation";

type Props = { url: string; title: string };
export function YoutubeLessonVideo(props: Props) {
  return <Player key={props.url} {...props} />;
}
function Player({ url, title }: Props) {
  const { t } = useLearningTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const host = container.current!;
    const frame = document.createElement("iframe");
    const src = new URL(url);
    src.searchParams.set("enablejsapi", "1");
    src.searchParams.set("origin", window.location.origin);
    src.searchParams.set("autoplay", "0");
    src.searchParams.set("playsinline", "1");
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.src = src.toString();
    frame.title = title;
    frame.className = "block h-full w-full";
    frame.allow = "encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    host.append(frame);
    let cancelled = false;
    let player: YoutubePlayer | undefined;
    const fail = () => { if (!cancelled) setFailed(true); };
    const timer = setTimeout(fail, 25_000);
    frame.onerror = fail;
    void loadYoutubePlayerApi().then(api => {
      if (cancelled) return;
      player = new api.Player(frame, { events: {
        onReady: () => { clearTimeout(timer); },
        onError: () => { clearTimeout(timer); fail(); },
      } });
    }).catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      frame.onerror = null;
      player?.destroy();
      host.replaceChildren();
    };
  }, [url, title]);
  return <div className="space-y-3">
    <div ref={container} className="aspect-video w-full overflow-hidden rounded-xl bg-black" />
    {failed && <p role="alert">{t("learning.videoError")}</p>}
  </div>;
}
