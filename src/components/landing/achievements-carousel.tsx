import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useAutoPlay } from "@/hooks/useAutoPlay";

gsap.registerPlugin(SplitText);

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type AchievementSlide = {
  image: string;
  title: string;
  date: string;
  href: string;
};

const AchievementsCarousel = ({ slides }: { slides: AchievementSlide[] }) => {
  const [index, setIndex] = useState(0);
  const slideRef = useRef<HTMLImageElement>(null);
  const dateRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLAnchorElement>(null);

  // tải trước toàn bộ ảnh ngay khi component mount, để lúc chuyển ảnh trình duyệt đã có sẵn ảnh giải mã xong, không bị khựng giữa lúc mờ dần
  useEffect(() => {
    slides.forEach(({ image }) => {
      const img = new Image();
      img.src = image;
    });
  }, [slides]);

  const goTo = (newIndex: number) => {
    if (newIndex === index || !slideRef.current) return;

    gsap.killTweensOf(slideRef.current);

    gsap.to(slideRef.current, {
      opacity: 0,
      duration: 0.4,
      ease: "power2.inOut",
      onComplete: () => {
        setIndex(newIndex);

        gsap.fromTo(
          slideRef.current,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.45,
            ease: "power2.out",
          },
        );
      },
    });
    // gsap.to(slideRef.current, {
    //   opacity: 0,
    //   duration: 0.3,
    //   onComplete: () => {
    //     setIndex(newIndex);
    //     gsap.to(slideRef.current, { opacity: 1, duration: 0.3 });
    //   },
    // });
  };

  useIsoLayoutEffect(() => {
    const titleElement = titleRef.current;
    const dateElement = dateRef.current;

    if (!titleElement) return;

    const split = SplitText.create(titleElement, {
      type: "lines,words",
      mask: "lines",
    });

    const timeline = gsap.timeline({
      defaults: {
        ease: "power3.out",
      },
    });

    if (dateElement) {
      timeline.fromTo(
        dateElement,
        {
          yPercent: 60,
          opacity: 0,
        },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.5,
        },
        0.05,
      );
    }

    if (split.words.length) {
      timeline.fromTo(
        split.words,
        {
          yPercent: 120,
        },
        {
          yPercent: 0,
          duration: 0.6,
          stagger: 0.02,
        },
        0.08,
      );
    }

    return () => {
      timeline.kill();

      try {
        split.revert();
      } catch {
        // Component có thể đã đổi nội dung trước lúc cleanup chạy.
      }
    };
  }, [index]);

  const next = () => goTo((index + 1) % slides.length);
  const prev = () => goTo((index - 1 + slides.length) % slides.length);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const SWIPE_THRESHOLD = 50; // ngưỡng để xác định vuốt ngang

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];

    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];

    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const passedThreshold = Math.abs(deltaX) >= SWIPE_THRESHOLD;

    if (!isHorizontalSwipe || !passedThreshold) return;

    e.preventDefault();

    if (deltaX < 0) {
      next();
    } else {
      prev();
    }
  };

  useAutoPlay(next, 7000, wrapperRef);

  const slide = slides[index];
  if (!slide) return null;

  return (
    <div ref={wrapperRef} className="flex w-full touch-pan-y select-none flex-col lg:flex-row"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}>
      <div className="contents">
        <div className="relative md:w-fit">
          <a href={slide.href} aria-label={slide.title} className="block">
            <img loading="lazy" decoding="async" ref={slideRef} src={slide.image} alt={slide.title} className="h-[400px] w-[779px] md:h-[397px] lg:h-[640px] lg:w-[649px] xl:w-[779px] object-cover" />
          </a>
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
            <button type="button" onClick={prev} aria-label="Previous achievement" className="cursor-pointer">
              <img loading="lazy" decoding="async" src="/Prev.svg" alt="" className="size-8" />
            </button>
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Ảnh ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={`h-[5px] w-10 rounded-full transition-colors ${i === index ? "bg-primary-foreground" : "bg-primary-foreground/30"
                    }`}
                />
              ))}
            </div>
            <button type="button" onClick={next} aria-label="Next achievement" className="cursor-pointer">
              <img loading="lazy" decoding="async" src="/Next.svg" alt="" className="size-8" />
            </button>
          </div>
        </div>
        <div className="relative grid grid-cols-1 md:grid-cols-2 w-full lg:flex lg:flex-col lg:flex-1">
          <div className="relative flex h-[280px] md:h-[320px] flex-col justify-between overflow-hidden p-6" style={{ backgroundImage: "linear-gradient(21deg, #1749DE 1%, rgba(10,9,19,0) 32%, #0C2778 72%)" }}>
            <img loading="lazy" decoding="async" src="/panelachievement.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
            <span ref={dateRef} className="relative w-fit rounded border border-border-container px-3 py-1 text-sm font-medium leading-[1.2] text-primary-foreground md:text-lg">{slide.date}</span>
            <a ref={titleRef} key={index} href={slide.href} className="relative text-2xl font-medium leading-[1.15] tracking-[-0.96px] text-primary-foreground md:text-[28px] md:tracking-[-1.12px]" style={{ fontFamily: "var(--font-heading)" }}>
              {slide.title}
            </a>
            <span className="absolute right-3 top-3 size-[6px] bg-foreground-muted" />
            <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-foreground-muted" />
            <span className="absolute bottom-3 right-3 size-[6px] bg-foreground-muted" />
          </div>
          <div className="achievement-grid-background relative flex h-[280px] md:h-[320px] items-center justify-center overflow-hidden bg-background" style={{ backgroundImage: "linear-gradient(90deg, var(--border) 0, var(--border) 1px, transparent 1px, transparent 100%)", backgroundSize: "12.5% 100%", backgroundRepeat: "repeat" }}>
            <div className="flex size-[90px] items-center justify-center border border-border bg-background">
              <img loading="lazy" decoding="async" src="/iconachievement.svg" alt="" className="size-10" />
            </div>
          </div>
        </div>
      </div>
      <style>{`
            .achievement-grid-background {
              animation: achievement-grid-move-left 1.2s linear infinite;
              will-change: background-position;
            }

            @keyframes achievement-grid-move-left {
              from { background-position: 0 0; }
              to { background-position: -12.5% 0; }
            }

            @media (prefers-reduced-motion: reduce) {
              .achievement-grid-background { animation: none; }
            }
          `}</style>
    </div>
  );
};

export default AchievementsCarousel;
