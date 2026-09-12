import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadYoutubePlayerApi, type YoutubePlayer } from "@/lib/youtubePlayerApi";
import { useLearningTranslation } from "./useLearningTranslation";

type Props = { url: string; title: string; watchUrl?: string };
export function YoutubeLessonVideo(props: Props) {
  return <Player key={props.url} {...props} />;
}
function Player({ url, title, watchUrl }: Props) {
  const { t } = useLearningTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const host = container.current!;
    const frame = document.createElement("iframe");
    const src = new URL(url);
    src.searchParams.set("enablejsapi", "1");
    src.searchParams.set("origin", window.location.origin);
    src.searchParams.set("autoplay", "0");
    src.searchParams.set("playsinline", "1");
    frame.src = src.toString();
    frame.title = title;
    frame.className = "aspect-video min-h-[200px] w-full rounded-xl bg-black";
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
  }, [url, title, retry]);
  return <div className="space-y-3">
    <div ref={container} />
    {failed && <p role="alert">{t("learning.videoError")}</p>}
    <div className="flex gap-3">
      <Button type="button" variant="ghost" onClick={() => { setFailed(false); setRetry(value => value + 1); }}>{t("learning.retryVideo")}</Button>
      <a href={watchUrl} target="_blank" rel="noreferrer" className="self-center text-sm text-primary underline">{t("learning.openYoutube")}</a>
    </div>
  </div>;
}
