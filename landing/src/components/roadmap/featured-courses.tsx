import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay } from "swiper/modules";
import { useSwiperCarousel } from "@/hooks/useSwiperCarousel";

import "swiper/css";
import "swiper/css/a11y";

gsap.registerPlugin(SplitText);
// layout effect an toàn SSR (island)
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Course = { title: string; range: string; lessons: string; image: string; desc: string, topics: string[] };
type Labels = { about: string; detail: string };

const FeaturedCourses = ({ courses, labels }: { courses: Course[]; labels: Labels }) => {
    const total = courses.length;

    const [tab, setTab] = useState<"about" | "detail">("about");
    const [cardWidth, setCardWidth] = useState(0);
    const [leftActive, setLeftActive] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        handleSwiper,
        slidePrev,
        slideNext,
    } = useSwiperCarousel();
    const detailRef = useRef<HTMLDivElement>(null);
    const numRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLParagraphElement>(null);
    const rangeRef = useRef<HTMLParagraphElement>(null);
    const descRef = useRef<HTMLParagraphElement>(null);
    const lessonsRef = useRef<HTMLParagraphElement>(null);

    const course = courses[leftActive];
    const num = String(leftActive + 1).padStart(2, "0")
    const imgH = (cardWidth * 675) / 1200;            // chiều cao ảnh 16:9 theo bề rộng
    const contentH = cardWidth ? imgH + 110 : 560;    // vùng dưới header = ảnh + thanh nav (khớp cả 2 tab)
    const k = contentH / 560;

    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const observer = new ResizeObserver((entries) => {
            setCardWidth(entries[0].contentRect.width);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [tab]);

    // const next = () => {
    //     setLeftActive((i) => (i + 1) % total);
    //     const newPosition = position + 1;
    //     gsap.to(trackRef.current, {
    //         x: -newPosition * cardWidth,
    //         duration: 0.5,
    //         ease: "power2.inOut",
    //         onComplete: () => {
    //             if (newPosition >= total * 2) {
    //                 gsap.set(trackRef.current, { x: -(newPosition - total) * cardWidth });
    //                 setPosition(newPosition - total);
    //             } else {
    //                 setPosition(newPosition);
    //             }
    //         },
    //     });
    // };
    // const prev = () => {
    //     setLeftActive((i) => (i - 1 + total) % total);
    //     const newPosition = position - 1;
    //     gsap.to(trackRef.current, {
    //         x: -newPosition * cardWidth,
    //         duration: 0.5,
    //         ease: "power2.inOut",
    //         onComplete: () => {
    //             if (newPosition < total) {
    //                 gsap.set(trackRef.current, { x: -(newPosition + total) * cardWidth });
    //                 setPosition(newPosition + total);
    //             } else {
    //                 setPosition(newPosition);
    //             }
    //         },
    //     });
    // };

    // // kéo chuột
    // const isDragging = useRef(false);
    // const startX = useRef(0);
    // const handleMouseDown = (e: React.MouseEvent) => {
    //     isDragging.current = true;
    //     startX.current = e.pageX;
    //     gsap.killTweensOf(trackRef.current);
    // };
    // useEffect(() => {
    //     const handleMouseMove = (e: MouseEvent) => {
    //         if (!isDragging.current || !trackRef.current) return;
    //         const delta = e.pageX - startX.current;
    //         if (Math.abs(delta) < 5) return;
    //         gsap.set(trackRef.current, { x: -position * cardWidth + delta });
    //     };
    //     const handleMouseUp = (e: MouseEvent) => {
    //         if (!isDragging.current) return;
    //         isDragging.current = false;
    //         const delta = e.pageX - startX.current;
    //         if (delta < -cardWidth / 4) next();
    //         else if (delta > cardWidth / 4) prev();
    //         else gsap.to(trackRef.current, { x: -position * cardWidth, duration: 0.3, ease: "power2.out" });
    //     };
    //     window.addEventListener("mousemove", handleMouseMove);
    //     window.addEventListener("mouseup", handleMouseUp);
    //     return () => {
    //         window.removeEventListener("mousemove", handleMouseMove);
    //         window.removeEventListener("mouseup", handleMouseUp);
    //     };
    // }, [position, cardWidth]);

    useEffect(() => {
        const el = detailRef.current;
        if (!el || tab !== "detail") return;

        let raf = 0;
        let paused = false;
        let dragging = false;
        let startX = 0;
        let startScroll = 0;
        const half = () => el.scrollWidth / 2;

        const updateCards = () => {
            const vpCenter = el.clientWidth / 2;
            const range = 380; // khoảng chuyển tiếp y (px) — nhỏ hơn = "kén" tâm hơn
            el.querySelectorAll<HTMLElement>("[data-detail-card]").forEach((card) => {
                const c = card.offsetLeft + card.offsetWidth / 2 - el.scrollLeft; // tâm card so với khung
                const t = Math.min(Math.abs(c - vpCenter) / range, 1);            // 0 ở giữa → 1 ở xa
                card.style.transform = `translateY(${30 * t}%)`;                  // giữa: 0%, xa: -50%
                const p = card.querySelector<HTMLElement>("[data-detail-text]");
                if (p) p.style.color = t < 0.4 ? "var(--foreground)" : "var(--border-strong)"; // giữa sáng, xa mờ
            });
        };

        const tick = () => {
            if (!paused) {
                el.scrollLeft += 2;
                if (el.scrollLeft >= half()) el.scrollLeft -= half();
            }
            updateCards();
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        const onWheel = (e: WheelEvent) => { e.preventDefault(); el.scrollLeft += e.deltaY + e.deltaX; };
        const onEnter = () => { paused = true; };
        const onLeave = () => { if (!dragging) paused = false; };
        const onDown = (e: MouseEvent) => { dragging = true; paused = true; startX = e.pageX; startScroll = el.scrollLeft; };
        const onMove = (e: MouseEvent) => { if (dragging) el.scrollLeft = startScroll - (e.pageX - startX); };
        const onUp = () => { dragging = false; paused = false; };

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
        el.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        return () => {
            cancelAnimationFrame(raf);
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("mouseenter", onEnter);
            el.removeEventListener("mouseleave", onLeave);
            el.removeEventListener("mousedown", onDown);
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [tab]);

    // Reveal cột trái khi đổi khóa (word-roll giống learning-journey)
    useIsoLayoutEffect(() => {
        const fadeEls = [rangeRef.current, lessonsRef.current].filter(Boolean) as HTMLElement[];
        const rollEls = [titleRef.current, descRef.current].filter(Boolean) as HTMLElement[];
        const splits = rollEls.map((el) => SplitText.create(el, { type: "lines,words", mask: "lines" }));
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        if (numRef.current) tl.fromTo(numRef.current, { yPercent: 100 }, { yPercent: 0, duration: 0.6 }, 0);
        if (fadeEls.length) tl.fromTo(fadeEls, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.06 }, 0.05);
        const words = splits.flatMap((s) => s.words);
        if (words.length) tl.fromTo(words, { yPercent: 120 }, { yPercent: 0, duration: 0.6, stagger: 0.02 }, 0.08);
        return () => {
            tl.kill();
            splits.forEach((s) => { try { s.revert(); } catch { } });
        };
    }, [leftActive]);

    // useAutoPlay(() => { if (tab === "about") next(); }, 7000, containerRef);

    return (
        <div className="flex flex-col lg:flex-row items-stretch">
            {/* left */}
            <div className="flex flex-row lg:w-[400px] shrink-0 lg:flex-col border-r border-border">
                <div className="flex flex-1 flex-col gap-6 p-6">
                    <div className="relative h-[110px] w-full overflow-hidden">
                        <div
                            ref={numRef}
                            className="absolute bottom-0 left-0 text-primary"
                            style={{
                                fontFamily: "var(--font-number)",
                                fontWeight: 100,
                                fontSize: `${Math.min(Math.max(cardWidth * 0.35, 48), 156)}px`,
                                lineHeight: "1.15",
                                letterSpacing: "-0.05em",
                                marginLeft: "-0.3em",
                                textBoxTrim: "trim-both",
                                textBoxEdge: " cap alphabetic",
                            } as React.CSSProperties}
                        >
                            {num}
                        </div>
                        <div
                            className="pointer-events-none absolute inset-y-0 left-0 w-10"
                            style={{ background: "linear-gradient(90deg, var(--background) 0%, transparent 100%)" }}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <p ref={titleRef} key={leftActive} className="text-2xl font-medium leading-[1.15] tracking-[-0.04em] text-foreground md:text-[28px]"
                            style={{ fontFamily: "var(--font-heading)" }}>
                            {course.title}
                        </p>
                        <p ref={rangeRef} className="text-sm leading-[1.4] text-border-strong md:text-base">{course.range}</p>
                    </div>
                </div>
                <div className="flex flex-1 flex-col justify-center gap-[10px] md:py-6 md:pl-6 md:pr-12">
                    <p ref={descRef} key={leftActive} className="text-base font-medium leading-[1.15] text-border-strong md:text-xl md:leading-[1.2]"
                        style={{ fontFamily: "var(--font-heading)" }}>
                        {course.desc}
                    </p>
                    <p ref={lessonsRef} className="text-sm leading-[1.4] text-foreground-subtle md:text-base">{course.lessons}</p>
                </div>
            </div>

            {/* right */}
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-20 items-center gap-8 border-b border-border bg-secondary px-8">
                    <button
                        type="button"
                        onClick={() => setTab("about")}
                        className={`text-lg leading-[1.15] tracking-[-0.02em] transition-colors md:text-2xl md:leading-[1.2] ${tab === "about" ? "text-foreground" : "text-foreground-subtle"}`} style={{ fontFamily: "var(--font-heading)" }}>
                        {labels.about}
                    </button>
                    <button type="button" onClick={() => setTab("detail")} className={`text-lg leading-[1.15] tracking-[-0.02em] transition-colors md:text-2xl md:leading-[1.2] ${tab === "detail" ? "text-foreground" : "text-foreground-subtle"}`} style={{ fontFamily: "var(--font-heading)" }}>
                        {labels.detail}
                    </button>
                </div>
                {tab === "about" ? (
                    <>
                        {/* slider — cơ chế different-carousel */}
                        <div ref={containerRef} className="overflow-hidden">
                            <Swiper
                                modules={[Autoplay, A11y]}
                                loop={total > 1}
                                initialSlide={leftActive}
                                speed={500}
                                slidesPerView={1}
                                slidesPerGroup={1}
                                allowTouchMove={true}
                                simulateTouch={true}
                                grabCursor={true}
                                threshold={5}
                                touchAngle={45}
                                shortSwipes={true}
                                longSwipes={true}
                                longSwipesRatio={0.25}
                                preventClicks={true}
                                preventClicksPropagation={true}
                                autoplay={
                                    total > 1
                                        ? {
                                            delay: 7000,
                                            disableOnInteraction: false,
                                            pauseOnMouseEnter: true,
                                        }
                                        : false
                                }
                                onSwiper={handleSwiper}
                                onSlideChange={(swiper) => {
                                    setLeftActive(swiper.realIndex);
                                }}
                                className="w-full"
                            >
                                {courses.map((c, i) => (
                                    <SwiperSlide key={`${c.title}-${i}`}>
                                        <img loading="lazy" decoding="async"
                                            src={c.image}
                                            alt={c.title}
                                            draggable={false}
                                            className="aspect-[1200/675] w-full object-cover"
                                        />
                                    </SwiperSlide>
                                ))}
                            </Swiper>
                        </div>
                        {/* nav prev/next */}
                        <div className="flex min-h-[110px] items-stretch border-t border-border bg-border/30">
                            <button type="button" onClick={slidePrev} aria-label="Khóa trước" className="flex flex-1 cursor-pointer items-center border-r border-border px-10 transition-opacity hover:opacity-70">
                                <img loading="lazy" decoding="async" src="/Prev.svg" alt="" className="size-8" />
                            </button>
                            <button type="button" onClick={slideNext} aria-label="Khóa sau" className="flex flex-1 cursor-pointer items-center justify-end px-10 transition-opacity hover:opacity-70">
                                <img loading="lazy" decoding="async" src="/Next.svg" alt="" className="size-8" />
                            </button>
                        </div>
                    </>
                ) : (
                    /* Chi tiết khoá: lưới 6 cột + card topic lệch chéo */
                    <div ref={detailRef} className="relative cursor-grab overflow-y-hidden active:cursor-grabbing" style={{ height: contentH, backgroundImage: "repeating-linear-gradient(to right, var(--border) 0 1px, transparent 1px calc(100%/6))" }}>
                        <div className="flex w-max items-center gap-16 px-16 select-none" style={{ height: contentH }}>
                            {[...course.topics, ...course.topics].map((topic, i) => (
                                <div
                                    key={i}
                                    data-detail-card
                                    className="flex w-[304px] shrink-0 border-2 border-border bg-background p-8"
                                    style={{ height: 432 * k }}
                                >
                                    <p data-detail-text className="text-2xl font-medium leading-[1.15] tracking-[-0.04em] text-border-strong transition-colors duration-300 md:text-[28px]"
                                        style={{ fontFamily: "var(--font-heading)" }}>
                                        {topic}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeaturedCourses;
