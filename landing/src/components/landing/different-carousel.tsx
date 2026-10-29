import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper/types";
import { useSwiperCarousel } from "@/hooks/useSwiperCarousel";

import "swiper/css";
import "swiper/css/a11y";
// import { useAutoPlay } from "@/hooks/useAutoPlay";
// import { useAutoPreviewHover } from "@/hooks/useAutoPreviewHover";

type DifferentItem = { title: string; description: string; image?: string };

const AUTO_DELAY_MS = 3000;

const DifferentCarousel = ({ items }: { items: DifferentItem[] }) => {
  // const total = items.length;
  // const extended = [...items, ...items, ...items];

  // const [cardWidth, setCardWidth] = useState(0);
  // const [visibleCount, setVisibleCount] = useState(3);
  // const [position, setPosition] = useState(total);
  // const containerRef = useRef<HTMLDivElement>(null);
  // const trackRef = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   if (!containerRef.current) return;
  //   const el = containerRef.current;
  //   const observer = new ResizeObserver((entries) => {
  //     let count;
  //     if (window.innerWidth < 768) {
  //       count = 1;
  //     } else if (window.innerWidth < 1280) {
  //       count = 2;
  //     } else {
  //       count = 3;
  //     }
  //     setCardWidth(entries[0].contentRect.width / count);
  //     setVisibleCount(count);
  //   });
  //   observer.observe(el);
  //   return () => observer.disconnect();
  // }, []);

  // useEffect(() => {
  //   const el = containerRef.current;
  //   if(!el) return;

  //   const getVisibleCount = () => {
  //     if (window.innerWidth < 768) return 1;
  //     if (window.innerWidth < 1280) return 2;
  //     return 3;
  //   };

  //   const updateCardWidth = () => {
  //     const containerWidth = el.getBoundingClientRect().width;

  //     if (containerWidth <= 0) return;

  //     const count = getVisibleCount();

  //     setVisibleCount(count);
  //     setCardWidth(containerWidth / count);
  //   };

  //   updateCardWidth();

  //   const frameId = window.requestAnimationFrame(updateCardWidth);

  //   const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateCardWidth()) : null;

  //   observer?.observe(el);
  //   window.addEventListener("resize", updateCardWidth);

  //   return () => {
  //     window.cancelAnimationFrame(frameId);
  //     observer?.disconnect();
  //     window.removeEventListener("resize", updateCardWidth)
  //   };
  // }, []);

  // const next = () => {
  //   const newPosition = position + 1;
  //   gsap.to(trackRef.current, {
  //     x: -newPosition * cardWidth,
  //     duration: 0.5,
  //     ease: "power2.inOut",
  //     onComplete: () => {
  //       if (newPosition >= total * 2) {
  //         gsap.set(trackRef.current, { x: -(newPosition - total) * cardWidth });
  //         setPosition(newPosition - total);
  //       } else {
  //         setPosition(newPosition);
  //       }
  //     },
  //   });
  // };
  // const prev = () => {
  //   const newPosition = position - 1;
  //   gsap.to(trackRef.current, {
  //     x: -newPosition * cardWidth,
  //     duration: 0.5,
  //     ease: "power2.inOut",
  //     onComplete: () => {
  //       if (newPosition < total) {
  //         gsap.set(trackRef.current, { x: -(newPosition + total) * cardWidth });
  //         setPosition(newPosition + total);
  //       } else {
  //         setPosition(newPosition);
  //       }
  //     },
  //   });
  // };

  // // mouse
  // const isDragging = useRef(false);
  // const startX = useRef(0);
  // // touch
  // const touchStartX = useRef(0);
  // const touchStartY = useRef(0);
  // const touchHasMoved = useRef(false);
  // const activeTouchCard = useRef<HTMLElement | null>(null);

  // const handleMouseDown = (e: React.MouseEvent) => {
  //   isDragging.current = true;
  //   startX.current = e.pageX;
  //   gsap.killTweensOf(trackRef.current);
  // };
  // useEffect(() => {
  //   const handleMouseMove = (e: MouseEvent) => {
  //     if (!isDragging.current || !trackRef.current) return;
  //     const delta = e.pageX - startX.current;
  //     if (Math.abs(delta) < 5) return;
  //     gsap.set(trackRef.current, { x: -position * cardWidth + delta });
  //   };
  //   const handleMouseUp = (e: MouseEvent) => {
  //     if (!isDragging.current) return;
  //     isDragging.current = false;
  //     const delta = e.pageX - startX.current;
  //     if (delta < -cardWidth / 4) {
  //       next();
  //     } else if (delta > cardWidth / 4) {
  //       prev();
  //     } else {
  //       gsap.to(trackRef.current, {
  //         x: -position * cardWidth,
  //         duration: 0.3,
  //         ease: "power2.out",
  //       });
  //     }
  //   };
  //   window.addEventListener("mousemove", handleMouseMove);
  //   window.addEventListener("mouseup", handleMouseUp);
  //   return () => {
  //     window.removeEventListener("mousemove", handleMouseMove);
  //     window.removeEventListener("mouseup", handleMouseUp);
  //   };
  // }, [position, cardWidth]);

  // const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
  //   const touch = e.touches[0];

  //   touchStartX.current = touch.clientX;
  //   touchStartY.current = touch.clientY;
  //   touchHasMoved.current = false;

  //   gsap.killTweensOf(trackRef.current);
  // };

  // const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
  //   if (!trackRef.current) return;

  //   const touch = e.touches[0];
  //   const deltaX = touch.clientX - touchStartX.current;
  //   const deltaY = touch.clientY - touchStartY.current;

  //   if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

  //   if (Math.abs(deltaX) > 5) {
  //     touchHasMoved.current = true;
  //   }

  //   gsap.set(trackRef.current, { x: -position * cardWidth + deltaX });
  // };

  // const handleTouchEnd = () => {
  //   if (!touchHasMoved.current) return;

  //   const currentX = gsap.getProperty(trackRef.current, "x") as number;
  //   const deltaX = currentX + position * cardWidth;

  //   if (deltaX < -cardWidth / 4) {
  //     next();
  //   } else if (deltaX > cardWidth / 4) {
  //     prev();
  //   } else {
  //     gsap.to(trackRef.current, {
  //       x: -position * cardWidth,
  //       duration: 0.3,
  //       ease: "power2.out",
  //     });
  //   }
  // };

  // const handleCardTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
  //   if (touchHasMoved.current) return;

  //   const card = e.currentTarget;

  //   if (activeTouchCard.current === card) {
  //     hideCard(card);
  //     activeTouchCard.current = null;
  //     return;
  //   }

  //   if (activeTouchCard.current) {
  //     hideCard(activeTouchCard.current);
  //   }

  //   revealCard(card);
  //   activeTouchCard.current = card;
  // };

  const revealCard = useCallback((card: HTMLElement) => {
    gsap.to(card.querySelector(`[data-reveal-bg]`), {
      scale: 1,
      duration: 0.5,
      ease: "power2.out",
      overwrite: true,
    });
    gsap.to(card.querySelector(`[data-icon-light]`), {
      opacity: 1,
      duration: 0.3,
      overwrite: true,
    });
    gsap.to(card.querySelector(`[data-description]`), {
      opacity: 1,
      scale: 1,
      duration: 0.4,
      delay: 0.05,
      overwrite: true,
    });
  }, []);
  const hideCard = useCallback((card: HTMLElement) => {
    gsap.to(card.querySelector(`[data-reveal-bg]`), {
      scale: 0,
      duration: 0.4,
      ease: "power2.out",
      overwrite: true,
    });
    gsap.to(card.querySelector(`[data-icon-light]`), {
      opacity: 0,
      duration: 0.3,
      overwrite: true,
    });
    gsap.to(card.querySelector(`[data-description]`), {
      opacity: 0,
      scale: 0,
      duration: 0.2,
      overwrite: true,
    });
  }, []);

  const {
    activeTouchItemRef,
    handleSwiper,
    handleTap,
    handleSliderFirstMove,
    handleTouchEnd,
    handleSlideChange,
    slideNext,
    slidePrev,
  } = useSwiperCarousel({
    itemSelector: "[data-different-card]",
    revealItem: revealCard,
    hideItem: hideCard,
  });

  const previewCardRef = useRef<HTMLElement | null>(null);
  const previewCallRef = useRef<gsap.core.Tween | null>(null);
  const hoveredCardRef = useRef<HTMLElement | null>(null);
  const visibleSlideIndexesRef = useRef<Set<number> | null>(null);

  const cancelAutoPreview = useCallback(() => {
    previewCallRef.current?.kill();
    previewCallRef.current = null;

    const previewCard = previewCardRef.current;

    if (
      previewCard && previewCard !== activeTouchItemRef.current
    ) {
      hideCard(previewCard);
    }

    previewCardRef.current = null;
  }, [activeTouchItemRef, hideCard]);

  const showAutoPreview = useCallback(
    (swiper: SwiperInstance) => {
      cancelAutoPreview();

      const visibleSlides = swiper.visibleSlides
        .map((slide) => {
          const slideIndex = Number(slide.dataset.swiperSlideIndex);
          const card = slide.querySelector<HTMLElement>(
            "[data-different-card]",
          );

          if (!Number.isInteger(slideIndex) || !card) return null;

          return { slideIndex, card };
        })
        .filter(
          (
            entry,
          ): entry is { slideIndex: number; card: HTMLElement } =>
            entry !== null,
        );

      const previousVisibleSlideIndexes = visibleSlideIndexesRef.current;
      const currentVisibleSlideIndexes = new Set(
        visibleSlides.map(({ slideIndex }) => slideIndex),
      );

      visibleSlideIndexesRef.current = currentVisibleSlideIndexes;

      const visibleCards = visibleSlides
        .filter(
          ({ slideIndex }) =>
            previousVisibleSlideIndexes === null ||
            !previousVisibleSlideIndexes.has(slideIndex),
        )
        .map(({ card }) => card);

      if (!visibleCards.length) return;

      const previewDurationSeconds = AUTO_DELAY_MS / visibleCards.length / 1000;

      const runPreview = (previewIndex: number) => {
        if (
          previewIndex >= visibleCards.length ||
          swiper.destroyed ||
          swiper.animating ||
          activeTouchItemRef.current
        ) {
          return;
        }

        const targetCard = visibleCards[previewIndex];

        previewCardRef.current = targetCard;
        revealCard(targetCard);

        previewCallRef.current = gsap.delayedCall(
          previewDurationSeconds,
          () => {
            if (activeTouchItemRef.current !== targetCard) {
              hideCard(targetCard);
            }

            previewCardRef.current = null;
            previewCallRef.current = null;

            runPreview(previewIndex + 1);
          },
        );
      };

      runPreview(0);
    },
    [
      activeTouchItemRef,
      cancelAutoPreview,
      hideCard,
      revealCard,
    ],
  );

  useEffect(() => {
    return () => {
      previewCallRef.current?.kill();
      hoveredCardRef.current = null;
      visibleSlideIndexesRef.current = null;
    };
  }, []);



  const handleCardEnter = (e: React.MouseEvent<HTMLDivElement>,) => {
    const card = e.currentTarget;

    hoveredCardRef.current = card;
    previewCallRef.current?.pause();
    revealCard(card);
  }
  // revealCard(e.currentTarget);
  const handleCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;

    if (hoveredCardRef.current === card) {
      hoveredCardRef.current = null;
    }

    if (previewCardRef.current !== card) {
      hideCard(card);
    }

    previewCallRef.current?.resume();
  };

  // useAutoPlay(next, 5000, containerRef);
  // useAutoPreviewHover(
  //   trackRef,
  //   position,
  //   visibleCount,
  //   revealCard,
  //   hideCard,
  //   2,
  // );

  return (
    <div className="border-x border-t border-border overflow-hidden">
      <Swiper
        modules={[Autoplay, A11y]}
        loop={true}
        slidesPerView={1}
        slidesPerGroup={1}
        speed={500}
        threshold={5}
        touchAngle={45}
        simulateTouch={true}
        grabCursor={true}
        shortSwipes={true}
        longSwipes={true}
        longSwipesRatio={0.25}
        preventClicks={true}
        preventClicksPropagation={true}
        watchSlidesProgress={true}
        breakpoints={{
          768: {
            slidesPerView: 2,
          },
          1280: {
            slidesPerView: 3,
          },
        }}
        autoplay={{
          delay: AUTO_DELAY_MS,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        onSwiper={handleSwiper}
        onAfterInit={showAutoPreview}
        onTap={(swiper, event) => {
          cancelAutoPreview();
          handleTap(swiper, event);
        }}
        onSliderFirstMove={() => {
          cancelAutoPreview();
          handleSliderFirstMove();
        }}
        onTouchEnd={handleTouchEnd}
        onSlideChange={() => {
          cancelAutoPreview();
          handleSlideChange();
        }}
        onSlideChangeTransitionEnd={showAutoPreview}
        onResize={showAutoPreview}
        className="overflow-hidden"
      >
        {items.map((item, i) => (
          <SwiperSlide
            key={`${i}-${item.title}`}
            style={{ height: "auto" }}
          >
            <div
              data-different-card
              className="relative flex h-full flex-col overflow-hidden border-x border-border"
              style={{
                aspectRatio: "2 / 3",
                containerType: "inline-size",
              }}
              onMouseEnter={handleCardEnter}
              onMouseLeave={handleCardLeave}
            >
              <div className="relative z-10 h-[138px] shrink-0 overflow-hidden border-b border-border">
                {/* lớp 2: số, bám góc dưới-trái, tràn ra ngoài, mờ dần */}
                <div
                  className="absolute bottom-0 left-0 text-primary"
                  style={
                    {
                      fontFamily: "var(--font-number)",
                      fontWeight: 100,
                      fontSize: "clamp(48px, 35cqw, 156px)",
                      lineHeight: "1.15",
                      letterSpacing: "-0.05em",
                      marginLeft: "-0.3em",
                      textBoxTrim: "trim-both",
                      textBoxEdge: " cap alphabetic",
                    } as React.CSSProperties
                  }
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-10"
                  style={{ background: "linear-gradient(90deg, var(--background) 0%, transparent 100%)" }}
                />
                {/* lớp 3: chữ, canh giữa, nổi trên cùng */}
                <div
                  className="absolute inset-0 z-10 flex px-8"
                  style={{
                    padding: "32px 40px 32px 120px",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "16px",
                    alignSelf: "stretch",
                  }}
                >
                  <span
                    className="text-2xl font-medium leading-[1.15] tracking-[-0.96px] md:text-[28px] md:tracking-[-1.12px]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {item.title}
                  </span>
                </div>
              </div>
              <div className="relative z-10 flex-1 p-3">
                {item.image && (
                  <img loading="lazy" decoding="async"
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  />
                )}
                <div className="relative flex h-[45%] items-start pt-10 pr-16 pb-5 pl-5">
                  <div
                    data-reveal-bg
                    className="absolute inset-0 origin-top-right scale-0"
                    style={{ backgroundColor: "var(--card)" }}
                  />
                  {/* icon */}
                  <div className="absolute right-0 top-0 flex h-10 border border-foreground w-10 items-center justify-center">
                    <img loading="lazy" decoding="async"
                      src={`/differenticon/df${i + 1}-dark.svg`}
                      alt=""
                      className="h-6 w-6"
                      draggable={false}
                    />
                  </div>
                  <div
                    data-icon-light
                    className="absolute opacity-0 right-0 top-0 flex h-10 w-10 items-center justify-center bg-foreground"
                  >
                    <img loading="lazy" decoding="async"
                      src={`/differenticon/df${i + 1}.svg`}
                      alt=""
                      className="h-6 w-6"
                      draggable={false}
                    />
                  </div>
                  <p
                    data-description
                    className="relative z-10 origin-top-right scale-0 text-sm leading-[1.4] text-foreground opacity-0 md:text-base"
                    style={{
                      fontStyle: "normal",
                      fontWeight: "450",
                    }}
                  >
                    {item.description}
                  </p>
                </div>
                <span className="absolute bottom-3 right-3 size-[6px] bg-foreground-muted" />
                <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-border" />
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <div className="flex items-stretch border-t border-border bg-popover">
        <button
          type="button"
          onClick={slidePrev}
          aria-label="Previous"
          className="flex flex-1 cursor-pointer items-center border-r border-border px-10 py-5"
        >
          <img loading="lazy" decoding="async" src="/Prev.svg" alt="" className="size-8" />
        </button>
        <button
          type="button"
          onClick={slideNext}
          aria-label="Next"
          className="flex flex-1 cursor-pointer items-center justify-end px-10 py-5"
        >
          <img loading="lazy" decoding="async" src="/Next.svg" alt="" className="size-8" />
        </button>
      </div>
    </div>
  );
};

export default DifferentCarousel;
