import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function LoadingBar() {
  const fetchingCount = useIsFetching({
    predicate: (query) => query.meta?.showInGlobalLoading !== false,
  });
  const mutatingCount = useIsMutating();
  const isLoading = fetchingCount > 0 || mutatingCount > 0;
  const [barState, setBarState] = useState({
    progress: 0,
    visible: false,
    fade: false,
  });
  const { progress, visible, fade } = barState;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let progressInterval: ReturnType<typeof setInterval> | undefined;

    if (isLoading) {
      queueMicrotask(() => {
        if (!cancelled) {
          setBarState({ progress: 5, visible: true, fade: false });
        }
      });

      timer = setTimeout(() => {
        setBarState((prev) => ({ ...prev, progress: 20 }));
      }, 100);

      progressInterval = setInterval(() => {
        setBarState((prev) => {
          if (prev.progress >= 90) {
            return prev;
          }
          const diff = 90 - prev.progress;
          const step = Math.max(1, diff * 0.1);
          return { ...prev, progress: Math.min(90, prev.progress + step) };
        });
      }, 200);
    } else {
      queueMicrotask(() => {
        if (!cancelled) {
          setBarState((prev) => ({ ...prev, progress: 100 }));
        }
      });

      timer = setTimeout(() => {
        setBarState((prev) => ({ ...prev, fade: true }));

        hideTimer = setTimeout(() => {
          setBarState({ progress: 0, visible: false, fade: false });
        }, 300);
      }, 200);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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
