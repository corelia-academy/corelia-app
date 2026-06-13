import { useEffect, useState } from "react";
import { useLoadingStore } from "@/stores/loadingStore";

export function LoadingBar() {
  const isLoading = useLoadingStore((s) => s.isLoading);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    let progressTimer: NodeJS.Timeout | undefined;
    let hideTimer: NodeJS.Timeout | undefined;
    let progressInterval: NodeJS.Timeout | undefined;

    if (isLoading) {
      timer = setTimeout(() => {
        setVisible(true);
        setFade(false);
        setProgress(5);
      }, 0);

      progressTimer = setTimeout(() => {
        setProgress(20);
      }, 100);

      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            return prev;
          }
          const diff = 90 - prev;
          const step = Math.max(1, diff * 0.1);
          return Math.min(90, prev + step);
        });
      }, 200);
    } else {
      timer = setTimeout(() => {
        setProgress(100);
        setFade(true);

        hideTimer = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 300);
      }, 200);
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (progressTimer) clearTimeout(progressTimer);
      if (hideTimer) clearTimeout(hideTimer);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes loading-bar-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .loading-bar-gradient {
          background-size: 200% auto;
          animation: loading-bar-shimmer 2s linear infinite;
        }
      `}</style>
      <div
        className={`fixed top-0 left-0 right-0 z-[9999] h-[3.5px] w-full transition-opacity duration-300 ${
          fade ? "opacity-0" : "opacity-100"
        }`}
      >
        <div
          className="loading-bar-gradient h-full bg-gradient-to-r from-primary via-brand-accent to-indigo-500 transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            boxShadow:
              progress > 0 && progress < 100
                ? "0 1px 12px color-mix(in oklch, var(--primary) 60%, transparent), 0 0 4px color-mix(in oklch, var(--brand-accent) 40%, transparent)"
                : "none",
          }}
        />
      </div>
    </>
  );
}
