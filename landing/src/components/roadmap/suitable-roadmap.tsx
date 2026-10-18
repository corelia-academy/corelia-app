import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay } from "swiper/modules";
import { useSwiperCarousel } from "@/hooks/useSwiperCarousel";
import { useState, useRef, useEffect } from "react";
import { gsap } from "gsap";

import "swiper/css";
import "swiper/css/a11y";

type Track = {
    id: string;
    title: string;
    summary: string;
    courseCount: string;
    courses: Course[];
};

type Course = {
    title: string;
    image: string;
    desc: string;
};

type SuitableRoadmapCarouselProps = {
    tracks: Track[];
    forLabel: string;
};

const SuitableRoadmapCarousel = ({
    tracks,
    forLabel,
}: SuitableRoadmapCarouselProps) => {
    const [activeTrackIndex, setActiveTrackIndex] = useState(0);
    const selectedTrackIndex = activeTrackIndex ?? 0;
    const activeTrack = tracks[selectedTrackIndex] ?? tracks[0];
    const courses = activeTrack?.courses ?? [];
    const total = courses.length;
    const [activeCourseIndex, setActiveCourseIndex] = useState(0);

    const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
    const trackRef = useRef<HTMLDivElement>(null);

    const isDragging = useRef(false);
    const dragMoved = useRef(false);
    const startY = useRef(0);
    const startScrollTop = useRef(0);

    const handleMouseDown = (event: React.MouseEvent) => {
        if (!trackRef.current) return;

        isDragging.current = true;
        dragMoved.current = false;
        startY.current = event.pageY;
        startScrollTop.current = trackRef.current.scrollTop;
    };

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            if (!isDragging.current || !trackRef.current) return;

            const delta = event.pageY - startY.current;

            if (Math.abs(delta) > 5) {
                dragMoved.current = true;
            }

            trackRef.current.scrollTop = startScrollTop.current - delta;
        };

        const handleMouseUp = () => {
            isDragging.current = false;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const scrollActiveTrackIntoView = (index: number) => {
        requestAnimationFrame(() => {
        const container = trackRef.current;
        const panel = panelRefs.current[index];

        if (!container || !panel) return;

        const containerRect = container.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();

        const topOverflow = panelRect.top - containerRect.top;
        const bottomOverflow = panelRect.bottom - containerRect.bottom;

        if (topOverflow < 10) {
            container.scrollBy({
                top: topOverflow - 100,
                behavior: "smooth",
            });
        } else if (bottomOverflow > -10) {
            container.scrollBy({
                top: bottomOverflow + 100,
                behavior: "smooth",
            });
        }
    });
    };

    const handleSelectTrack = (index: number) => {
        if (dragMoved.current || activeTrackIndex === index) return;

        const previousPanel = panelRefs.current[activeTrackIndex];

        if (!previousPanel) {
            setActiveTrackIndex(index);
            return;
        }

        gsap.killTweensOf(previousPanel);

        gsap.to(previousPanel, {
            height: 0,
            duration: 0.35,
            ease: "power2.inOut",
            onComplete: () => {
                setActiveTrackIndex(index);

                requestAnimationFrame(() => {
                    const nextPanel = panelRefs.current[index];

                    if (!nextPanel) return;

                    gsap.fromTo(
                        nextPanel,
                        { height: 0 },
                        {
                            height: nextPanel.scrollHeight,
                            duration: 0.5,
                            ease: "power2.inOut",
                            onComplete: () => {
                                scrollActiveTrackIntoView(index);
                            },
                        },
                    );
                });
            },
        });
    };
    useEffect(() => {
        const firstPanel = panelRefs.current[0];

        if (firstPanel) {
            gsap.set(firstPanel, {
                height: firstPanel.scrollHeight,
            });
        }
    }, []);

    const {
        swiperRef,
        handleSwiper,
        slidePrev,
        slideNext,
    } = useSwiperCarousel();

    return (
        <div className="grid min-w-0 grid-cols-1 items-stretch lg:grid-cols-2">
            <div className="flex min-w-0 flex-col border-border lg:border-r">
                {/* <div
                    className="flex min-h-[280px] shrink-0 flex-col justify-between border-b border-border bg-cover bg-center p-6 md:min-h-[300px] md:p-8"
                    style={{ backgroundImage: "url('/panelmini.png')" }}
                >
                    <p className="w-fit border border-border-strong px-2 py-1 text-[10px] leading-[1.4] text-foreground md:text-xs md:leading-[1.2]">
                        {activeTrack.summary}
                    </p>

                    <div className="flex flex-col gap-4">
                        <p className="text-2xl font-medium leading-[1.2] tracking-[-0.04em] text-foreground md:text-[32px]">
                            {forLabel}
                        </p>

                        <div className="flex items-center gap-2">
                            <span aria-hidden="true">&lt;</span>
                            <span className="bg-foreground px-2 py-1 font-medium text-primary">
                                {activeTrack.title}
                            </span>
                            <span aria-hidden="true">&gt;</span>
                        </div>
                    </div>
                </div> */}

                <div className="flex min-h-0 flex-1 flex-col">
                    <div
                        ref={trackRef}
                        onMouseDown={handleMouseDown}
                        className="cursor-grab min-h-0 max-h-[395px] md:max-h-[695px] select-none overflow-y-auto active:cursor-grabbing"
                    >
                        {tracks.map((track, index) => {
                            const isActive = index === activeTrackIndex;
                            return (

                                <div
                                    key={track.id}
                                    className="border-b border-border last:border-b-0"
                                >
                                    {!isActive && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectTrack(index)}
                                            className="flex h-24 min-h-24 w-full items-center justify-between gap-4 px-6 text-left md:px-8"
                                        >
                                            <span
                                                className="text-base font-medium leading-[1.15] text-foreground md:text-xl md:leading-[1.2]"
                                                style={{ fontFamily: "var(--font-heading)" }}
                                            >
                                                &lt; {track.title} &gt;
                                            </span>

                                            <span
                                                className="border border-border-strong px-2 py-1 text-[10px] leading-[1.2] md:text-xs"
                                                style={{ fontFamily: "var(--font-number)" }}
                                            >
                                                {track.courseCount}
                                            </span>
                                        </button>
                                    )}

                                    <div
                                        ref={(element) => {
                                            panelRefs.current[index] = element;
                                        }}
                                        className="h-0 overflow-hidden bg-cover bg-center"
                                        style={{
                                            backgroundImage: "url('/panelmini.png')",
                                        }}
                                    >
                                        <div className="flex min-h-[200px] flex-col justify-between p-6 md:min-h-[280px] md:p-8">
                                            <p className="w-fit border border-border-strong px-2 py-1 text-sm font-medium leading-[1.2] text-foreground md:text-lg">{track.summary}</p>

                                            <div className="flex flex-col gap-3">
                                                <p
                                                    className="text-4xl font-medium leading-[1.15] tracking-[-0.05em] text-foreground md:text-5xl md:tracking-[-0.04em]"
                                                    style={{ fontFamily: "var(--font-heading)" }}
                                                >
                                                    {forLabel}
                                                </p>

                                                <div className="flex items-center gap-2">
                                                    <span
                                                        aria-hidden="true"
                                                        className="text-2xl font-medium text-foreground"
                                                    >
                                                        _
                                                    </span>

                                                    <span className="w-fit bg-foreground px-2 py-1 text-sm font-medium leading-[1.2] text-primary md:text-lg">
                                                        &lt; {track.title} &gt;
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="min-w-0">
                <div className="overflow-hidden">
                    <Swiper
                        key={activeTrack.id}
                        modules={[Autoplay, A11y]}
                        loop={total > 1}
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
                            setActiveCourseIndex(swiper.realIndex);
                        }}
                        className="w-full"
                    >
                        {courses.map((course, index) => (
                            <SwiperSlide key={`${course.title}-${index}`}>
                                <div className="flex h-full flex-col">
                                    <div className="flex h-20 shrink-0 items-center justify-center border-b border-border bg-secondary px-6">
                                        <p
                                            className="text-lg font-medium leading-[1.15] tracking-[-0.02em] text-foreground md:text-2xl md:leading-[1.2]"
                                            style={{
                                                fontFamily:
                                                    "var(--font-heading)",
                                            }}
                                        >
                                            {course.title}
                                        </p>
                                    </div>

                                    <img loading="lazy" decoding="async"
                                        src={course.image}
                                        alt={course.title}
                                        draggable={false}
                                        className="aspect-[1200/675] w-full object-cover"
                                    />

                                    <div className="min-h-[100px] shrink-0 border-t border-border bg-secondary px-6 py-5 md:min-h-[198px] md:px-8 md:py-6">
                                        <p className="text-sm font-normal leading-[1.4] text-foreground md:text-base">
                                            {course.desc}
                                        </p>
                                    </div>
                                </div>
                            </SwiperSlide>
                        ))}
                    </Swiper>
                </div>

                <div className="flex min-h-[80px] items-center justify-center gap-3 border-t border-border bg-border/30 px-10">
                    <button
                        type="button"
                        onClick={slidePrev}
                        aria-label="Khóa trước"
                        className="cursor-pointer transition-opacity hover:opacity-70 mr-auto"
                    >
                        <img loading="lazy" decoding="async" src="/Prev.svg" alt="" className="size-8" />
                    </button>

                    <div className="flex gap-2">
                        {courses.map((_, index) => (
                            <button
                                key={index}
                                type="button"
                                aria-label={`Khóa ${index + 1}`}
                                onClick={() => {
                                    swiperRef.current?.slideToLoop(index);
                                }}
                                className={`h-[5px] w-10 rounded-full transition-colors ${index === activeCourseIndex
                                    ? "bg-primary-foreground"
                                    : "bg-primary-foreground/30"
                                    }`}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={slideNext}
                        aria-label="Khóa sau"
                        className="cursor-pointer transition-opacity hover:opacity-70 ml-auto"
                    >
                        <img loading="lazy" decoding="async" src="/Next.svg" alt="" className="size-8" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuitableRoadmapCarousel;
