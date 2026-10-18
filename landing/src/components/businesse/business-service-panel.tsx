import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { gsap } from "gsap";

const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

const isDesktopViewport = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 768px)").matches;

type ServiceSlide = {
    src: string;
    alt: string;
    title: string;
};

type PanelContent = {
    eyebrow: string;
    description: string;
};

type Props = {
    slides: ServiceSlide[];
    backgroundSrc: string;
    panelContent: PanelContent;
};

export default function BusinessServicePanelCarousel({
    slides,
    backgroundSrc,
    panelContent,
}: Props) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPanelReversed, setIsPanelReversed] = useState(false); // đảo chiều
    const [isPanelExpanded, setIsPanelExpanded] = useState(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const panelShellRef = useRef<HTMLDivElement>(null);
    const panelTitleMaskRef = useRef<HTMLDivElement>(null);
    const panelHeaderRef = useRef<HTMLDivElement>(null);
    const panelBodyRef = useRef<HTMLDivElement>(null);
    const iconGroup2Ref = useRef<HTMLImageElement>(null);
    const iconGroup3Ref = useRef<HTMLImageElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const isTransitioningRef = useRef(false);
    const lastPointerTypeRef = useRef<string>("");

    useIsoLayoutEffect(() => {
        const body = panelBodyRef.current;
        const iconGroup2 = iconGroup2Ref.current;
        const iconGroup3 = iconGroup3Ref.current;

        if (!body || !iconGroup2 || !iconGroup3) return;

        if (isDesktopViewport()) {
            gsap.set(body, {
                clearProps:
                    "height,minHeight,paddingTop,paddingBottom,opacity,overflow",
            });

            gsap.set(iconGroup3, {
                opacity: 0,
                scale: 0.5,
                rotate: -90,
                transformOrigin: "50% 50%",
            });

            gsap.set(iconGroup2, {
                opacity: 1,
                scale: 1,
                rotate: 0,
                transformOrigin: "50% 50%",
            });

            setIsPanelExpanded(true);
            return;
        }

        gsap.set(body, {
            height: 0,
            minHeight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            opacity: 0,
            overflow: "hidden",
        });

        gsap.set(iconGroup3, {
            opacity: 1,
            scale: 1,
            rotate: 0,
            transformOrigin: "50% 50%",
        });

        gsap.set(iconGroup2, {
            opacity: 0,
            scale: 0.5,
            rotate: 90,
            transformOrigin: "50% 50%",
        });
    }, []);

    const scrollActiveServiceIntoView = (index: number) => {
        requestAnimationFrame(() => {
            const container = trackRef.current;
            const item = itemRefs.current[index];

            if (!container || !item) return;

            const containerRect = container.getBoundingClientRect();
            const itemRect = item.getBoundingClientRect();

            const topOverflow = itemRect.top - containerRect.top;
            const bottomOverflow = itemRect.bottom - containerRect.bottom;

            if (topOverflow < 10) {
                container.scrollBy({
                    top: topOverflow - 50,
                    behavior: "smooth",
                });
            } else if (bottomOverflow > -10) {
                container.scrollBy({
                    top: bottomOverflow + 70,
                    behavior: "smooth",
                });
            }
        });
    };

    const animatePanel = (shouldExpand: boolean) => {
        const body = panelBodyRef.current;
        const iconGroup2 = iconGroup2Ref.current;
        const iconGroup3 = iconGroup3Ref.current;

        if (!body || !iconGroup2 ||
            !iconGroup3 || isTransitioningRef.current) return;

        gsap.killTweensOf([
            body,
            iconGroup2,
            iconGroup3,
        ]);

        if (!shouldExpand) {
            gsap.to(body, {
                height: 0,
                paddingTop: 0,
                paddingBottom: 0,
                opacity: 0,
                overflow: "hidden",
                duration: 0.38,
                ease: "power3.inOut",
            });

            gsap.to(iconGroup2, {
                opacity: 0,
                scale: 0.5,
                rotate: 90,
                duration: 0.58,
                ease: "power3.inOut",
            });

            gsap.to(iconGroup3, {
                opacity: 1,
                scale: 1,
                rotate: 0,
                duration: 0.58,
                ease: "power3.inOut",
            });

            setIsPanelExpanded(false);
            return;
        }

        gsap.set(body, {
            clearProps: "height,minHeight,paddingTop,paddingBottom,opacity",
        });

        const computedStyle = window.getComputedStyle(body);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const expandedHeight = body.offsetHeight;

        gsap.set(body, {
            height: 0,
            minHeight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            opacity: 0,
            overflow: "hidden",
        });

        gsap.to(body, {
            height: expandedHeight,
            minHeight: 0,
            paddingTop,
            paddingBottom,
            opacity: 1,
            overflow: "hidden",
            duration: 0.48,
            ease: "power3.out",
            onComplete: () => {
                gsap.set(body, {
                    clearProps: "height,paddingTop,paddingBottom,opacity",
                });
            },
        });

        gsap.to(iconGroup2, {
            opacity: 1,
            scale: 1,
            rotate: 0,
            duration: 0.58,
            ease: "power3.out",
        });

        gsap.to(iconGroup3, {
            opacity: 0,
            scale: 0.5,
            rotate: -90,
            duration: 0.58,
            ease: "power3.out",
        });

        setIsPanelExpanded(true);
    };

    const togglePanel = () => {
        animatePanel(!isPanelExpanded);
    };

    const handlePanelKeyDown = (
        event: React.KeyboardEvent<HTMLDivElement>,
    ) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            togglePanel();
        }
    };

    const handleStagePointerEnter = (
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        if (!isDesktopViewport() && event.pointerType === "mouse") {
            animatePanel(true);
        }
    };

    const handleStagePointerLeave = (
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        if (!isDesktopViewport() && event.pointerType === "mouse") {
            animatePanel(false);
        }
    };

    const handleStagePointerDown = (
        event: React.PointerEvent<HTMLDivElement>,
    ) => {
        lastPointerTypeRef.current = event.pointerType;
    };

    const handleStageClick = (
        event: React.MouseEvent<HTMLDivElement>,
    ) => {
        // Không xử lý click sinh ra từ bàn phím.
        if (event.detail === 0) return;

        // Chuột dùng hover; touch và pen dùng tap.
        if (lastPointerTypeRef.current !== "mouse") {
            togglePanel();
        }
    };

    const goTo = (
        nextIndex: number,
        skipPanelClose = false,
    ) => {
        const image = imageRef.current;
        const panelShell = panelShellRef.current;
        const panelTitleMask = panelTitleMaskRef.current;
        const header = panelHeaderRef.current;
        const body = panelBodyRef.current;
        const iconGroup2 = iconGroup2Ref.current;
        const iconGroup3 = iconGroup3Ref.current;

        if (
            nextIndex === activeIndex ||
            !image ||
            !panelShell ||
            !panelTitleMask ||
            !header ||
            !body ||
            !iconGroup2 ||
            !iconGroup3 ||
            isTransitioningRef.current
        ) {
            return;
        }

        if (isPanelExpanded && !skipPanelClose) {
            isTransitioningRef.current = true;

            gsap.killTweensOf([
                body,
                iconGroup2,
                iconGroup3,
            ]);

            const closeTimeline = gsap.timeline({
                onComplete: () => {
                    setIsPanelExpanded(false);
                    isTransitioningRef.current = false;

                    goTo(nextIndex, true);
                },
            });

            closeTimeline
                .to(
                    body,
                    {
                        height: 0,
                        minHeight: 0,
                        paddingTop: 0,
                        paddingBottom: 0,
                        opacity: 0,
                        overflow: "hidden",
                        duration: 0.38,
                        ease: "power3.inOut",
                    },
                    0,
                )
                .to(
                    iconGroup2,
                    {
                        opacity: 0,
                        scale: 0.5,
                        rotate: 90,
                        duration: 0.58,
                        ease: "power3.inOut",
                    },
                    0,
                )
                .to(
                    iconGroup3,
                    {
                        opacity: 1,
                        scale: 1,
                        rotate: 0,
                        duration: 0.58,
                        ease: "power3.inOut",
                    },
                    0,
                );

            return;
        }

        // const headerHeight = header.offsetHeight;
        const expandedPanelWidth = panelShell.offsetWidth;

        isTransitioningRef.current = true;
        setIsPanelExpanded(false);

        gsap.set(body, {
            height: 0,
            minHeight: 0,
            paddingTop: 0,
            paddingBottom: 0,
            opacity: 0,
            overflow: "hidden",
        });

        scrollActiveServiceIntoView(nextIndex);

        gsap.killTweensOf([
            image,
            panelShell,
            panelTitleMask,
            header,
            body,
        ]);

        const collapseTimeline = gsap.timeline({
            defaults: {
                ease: "power3.inOut",
            },
        });

        collapseTimeline
            .to(
                image,
                {
                    scale: 0.82,
                    y: 110,
                    opacity: 0,
                    duration: 0.58,
                    ease: "power3.inOut",
                },
                0,
            )
            .to(
                panelShell,
                {
                    width: 74,
                    duration: 0.58,
                    ease: "power3.inOut",
                },
                0,
            )
            .to(
                panelTitleMask,
                {
                    clipPath: "inset(0 100% 0 0)",
                    duration: 0.58,
                    ease: "power3.inOut",
                },
                0,
            )
            .call(() => {
                flushSync(() => {
                    setActiveIndex(nextIndex);
                    setIsPanelReversed((current) => !current); //đảo chiều
                });

                requestAnimationFrame(() => {
                    const nextPanelTitleMask = panelTitleMaskRef.current;

                    if (!nextPanelTitleMask) {
                        isTransitioningRef.current = false;
                        return;
                    }

                    gsap.set(panelShell, {
                        width: 74,
                    });

                    gsap.set(nextPanelTitleMask, {
                        clipPath: "inset(0% 100% 0% 0%)",
                    });

                    gsap.set(image, {
                        scale: 0.82,
                        y: 110,
                        opacity: 0,
                    });

                    const expandTimeline = gsap.timeline({
                        defaults: {
                            ease: "power3.inOut",
                        },
                        onComplete: () => {
                            gsap.set(image, {
                                clearProps: "scale,y,opacity",
                            });

                            gsap.set(panelShell, {
                                clearProps: "width",
                            });

                            gsap.set(nextPanelTitleMask, {
                                clearProps: "clipPath",
                            });

                            gsap.set(body, {
                                height: 0,
                                minHeight: 0,
                                paddingTop: 0,
                                paddingBottom: 0,
                                opacity: 0,
                                overflow: "hidden",
                            });

                            isTransitioningRef.current = false;

                            if (isDesktopViewport()) {
                                requestAnimationFrame(() => {
                                    animatePanel(true);
                                });
                            }
                        },
                    });

                    expandTimeline
                        .to(
                            panelShell,
                            {
                                width: expandedPanelWidth,
                                duration: 0.68,
                                ease: "power3.inOut",
                            },
                            0,
                        )
                        .to(
                            nextPanelTitleMask,
                            {
                                clipPath: "inset(0% 0% 0% 0%)",
                                duration: 0.68,
                                ease: "power3.inOut",
                            },
                            0,
                        )
                        .to(
                            image,
                            {
                                scale: 1,
                                y: 0,
                                opacity: 1,
                                duration: 0.68,
                                ease: "power3.inOut",
                            },
                            0,
                        );
                });
            });
    };

    const previous = () => {
        goTo((activeIndex - 1 + slides.length) % slides.length);
    };

    const next = () => {
        goTo((activeIndex + 1) % slides.length);
    };

    const activeSlide = slides[activeIndex];

    if (!activeSlide) return null;

    return (
        <div>
            <div className="container mx-auto max-w-(--app-max-width) px-3 xl:px-0">
                <div className="overflow-hidden border-x border-border">
                    <div className="flex min-h-[80px] items-center border-y border-border bg-popover px-6">
                        <span
                            className="text-sm text-foreground"
                            style={{ fontFamily: "var(--font-body)" }}
                        >
                            {panelContent.eyebrow}
                        </span>
                    </div>

                    <div
                        ref={trackRef}
                        className="grid grid-cols-1 h-[240px] lg:h-full lg:overflow-y-visible overflow-y-auto md:grid-cols-2 lg:grid-cols-3"
                    >
                        {slides.map((slide, i) => (
                            <button
                                ref={(element) => {
                                    itemRefs.current[i] = element;
                                }}
                                key={slide.src}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-label={`Open ${slide.title}`}
                                aria-current={i === activeIndex ? "true" : undefined}
                                className="relative flex h-[120px] cursor-pointer items-center overflow-hidden border-b border-border text-left"
                                style={{ containerType: "inline-size" }}
                            >
                                <span
                                    className={`absolute bottom-0 left-0 z-0 transition-colors duration-700 ${i === activeIndex
                                        ? "text-primary"
                                        : "text-secondary"
                                        }`}
                                    style={{
                                        fontFamily: "var(--font-number)",
                                        fontWeight: 100,
                                        fontSize: "clamp(48px, 35cqw, 156px)",
                                        lineHeight: "1.15",
                                        letterSpacing: "-0.05em",
                                        marginLeft: "-0.3em",
                                        textBoxTrim: "trim-both",
                                        textBoxEdge: " cap alphabetic",
                                    } as React.CSSProperties}
                                >
                                    {String(i + 1).padStart(2, "0")}
                                </span>

                                <div
                                    className="pointer-events-none absolute inset-y-0 left-0 w-10"
                                    style={{
                                        background:
                                            "linear-gradient(90deg, var(--background) 0%, transparent 100%)",
                                    }}
                                />

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
                                        {slide.title}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="w-full border-t border-border">
                <div className="container mx-auto max-w-(--app-max-width) px-3 xl:px-0">
                    <div className="relative border-x border-border">
                        <div className="relative md:aspect-[1200/680] min-h-[380px] overflow-hidden"
                            onPointerEnter={handleStagePointerEnter}
                            onPointerLeave={handleStagePointerLeave}
                            onPointerDown={handleStagePointerDown}
                            onClick={handleStageClick}>
                            <img loading="lazy" decoding="async"
                                src={backgroundSrc}
                                alt=""
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover object-center"
                            />

                            <img loading="lazy" decoding="async"
                                ref={imageRef}
                                src={activeSlide.src}
                                alt={activeSlide.alt}
                                className="pointer-events-none absolute left-1/2 top-[3.8%] z-10 w-[100%] md:w-[56.333%] max-w-[676px] -translate-x-1/2 object-contain select-none"
                            />

                            <div
                                ref={panelShellRef}
                                className="absolute bottom-5 left-5 z-15 w-[min(420px,calc(100%-48px))]"
                            >
                                {/* <div className="relative overflow-hidden border-x border-t border-border"> */}
                                <div
                                    className={`relative flex overflow-hidden border-x border-t border-border ${isPanelReversed ? "flex-col-reverse" : "flex-col"
                                        }`}
                                >
                                <div
                                    ref={panelHeaderRef}
                                    role="button"
                                        tabIndex={0}
                                        aria-expanded={isPanelExpanded}
                                        onKeyDown={handlePanelKeyDown}
                                        className="flex min-h-[54px] cursor-pointer items-center justify-between border-b border-border px-5 py-3"
                                        style={{ background: "rgba(10, 9, 19, 0.70)" }}
                                    >
                                        <div
                                            ref={panelTitleMaskRef}
                                            className="min-w-0 flex-1 overflow-hidden"
                                        >
                                            <p
                                                className="w-max whitespace-nowrap text-base md:text-[20px] truncate font-medium leading-[1.2] tracking-[-0.02em] text-foreground"
                                                style={{ fontFamily: "var(--font-body)" }}
                                            >
                                                {/* what we can help width */}
                                                {activeSlide.title}
                                            </p>
                                        </div>

                                        <div className="pointer-events-none relative size-8 shrink-0">
                                            <img loading="lazy" decoding="async"
                                                ref={iconGroup3Ref}
                                                src="/Group_3.svg"
                                                alt=""
                                                aria-hidden="true"
                                                className="absolute inset-0 size-8"
                                            />

                                            <img loading="lazy" decoding="async"
                                                ref={iconGroup2Ref}
                                                src="/Group_2.svg"
                                                alt=""
                                                aria-hidden="true"
                                                className="absolute inset-0 size-8"
                                            />
                                        </div>
                                    </div>

                                    <div ref={panelBodyRef} className="relative bg-card lg:min-h-0 lg:overflow-hidden p-5">
                                        <span
                                            className="pointer-events-none absolute left-0 top-0 h-px w-9 bg-foreground"
                                            aria-hidden="true"
                                        />
                                        <p
                                            className="text-[10px] leading-[1.2] text-foreground-muted md:text-xs"
                                            style={{ fontFamily: "var(--font-number)" }}
                                        >
                                            {panelContent.eyebrow}
                                        </p>

                                        <h2
                                            id="business-service-panel-title"
                                            className="mt-6 text-2xl font-medium leading-[1.15] tracking-[-0.04em] text-foreground md:text-[28px]"
                                            style={{ fontFamily: "var(--font-heading)" }}
                                        >
                                            {activeSlide.title}
                                        </h2>

                                        <p className="mt-6 text-sm leading-[1.4] text-foreground-muted md:text-base">
                                            {panelContent.description}
                                        </p>
                                        <span
                                            className="pointer-events-none absolute bottom-0 right-0 h-px w-9 bg-foreground"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-stretch border-t border-border bg-popover">
                            <button
                                type="button"
                                onClick={previous}
                                aria-label="Previous service"
                                className="flex flex-1 cursor-pointer items-center border-r border-border px-10 py-5"
                            >
                                <img loading="lazy" decoding="async" src="/Prev.svg" alt="" className="size-8" />
                            </button>

                            <button
                                type="button"
                                onClick={next}
                                aria-label="Next service"
                                className="flex flex-1 cursor-pointer items-center justify-end px-10 py-5"
                            >
                                <img loading="lazy" decoding="async" src="/Next.svg" alt="" className="size-8" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
