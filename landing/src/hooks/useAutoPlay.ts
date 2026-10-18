import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export function useAutoPlay (
    advance : () => void,
    intervalMs: number,
    pauseRef?: React.RefObject<HTMLElement | null>,
) {
    const advanceRef = useRef(advance);
    advanceRef.current = advance;

    useEffect(() => {
        const el = pauseRef?.current;
        let isVisible = !el;

        const tween = gsap.to({}, {
            duration: intervalMs / 1000,
            repeat: -1,
            onRepeat: () => advanceRef.current(),
            paused: Boolean(el),
        });

        const onEnter = () => tween.pause();
        const onLeave = () => {
            if (isVisible) tween.resume();
        };

        const observer = el
            ? new IntersectionObserver(
                ([entry]) => {
                    isVisible = entry.isIntersecting;

                    if (isVisible) {
                        tween.resume();
                    } else {
                        tween.pause();
                    }
                },
                { rootMargin: "100px" },
            )
            : null;

        if (el) observer?.observe(el);
        el?.addEventListener("mouseenter", onEnter);
        el?.addEventListener("mouseleave", onLeave);

        return () => {
            tween.kill();
            observer?.disconnect();
            el?.removeEventListener("mouseenter", onEnter);
            el?.removeEventListener("mouseleave", onLeave);
        };
    }, [intervalMs]);
}
