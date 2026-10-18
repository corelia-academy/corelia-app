import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(SplitText);

type Step = { description: string };

const LearningJourney = ({ steps, verticalText }: { steps: Step[]; verticalText: string }) => {
    const [active, setActive] = useState(0);
    const [colorsIndexs, setColorsIndex] = useState(0);
    const [cardWidth, setCardWidth] = useState(0);
    const [isVerticalLayout, setIsVerticalLayout] = useState(false);
    const [horizontalPanelWidth, setHorizontalPanelWidth] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
    const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
    // animate new
    const iconRefs = useRef<(HTMLDivElement | null)[]>([]);
    const textRefs = useRef<(HTMLDivElement | null)[]>([]);
    const descRefs = useRef<(HTMLParagraphElement | null)[]>([]);
    const hasUserInteractedRef = useRef(false);
    const selectedIndexRef = useRef(0);

    useEffect(() => {
        if (!containerRef.current) return;
        const el = containerRef.current;
        const observer = new ResizeObserver((entries) => {
            const containerWidth = entries[0].contentRect.width;

            const horizontalTabsWidth = steps.length * 100;
            const textBlockWidth = 520;

            const nextHorizontalPanelWidth = Math.min(
                800,
                containerWidth - horizontalTabsWidth,
            );

            const textLeftGap = nextHorizontalPanelWidth - textBlockWidth;
            setCardWidth(containerWidth / steps.length);
            setHorizontalPanelWidth(nextHorizontalPanelWidth);
            setIsVerticalLayout(textLeftGap <= 0);
            // setCardWidth(entries[0].contentRect.width / steps.length);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [steps.length]);

    // Reveal REPLAY: mỗi lần đổi step (mở panel) → tách chữ + cuộn lại; cleanup revert() (đóng = reset)
    useEffect(() => {
        const el = descRefs.current[colorsIndexs];
        if (!el || !hasUserInteractedRef.current) return;
        const split = SplitText.create(el, { type: "lines,words", mask: "lines" });
        const tween = gsap.fromTo(
            split.words,
            { yPercent: 120 },
            { yPercent: 0, duration: 0.5, ease: "power3.out", stagger: 0.03 },
        );
        return () => {
            tween.kill();
            try { split.revert(); } catch { }
        };
    }, [colorsIndexs]);

    const getOpenWidth = () => horizontalPanelWidth;
    const getOpenHeight = () => {
        if (!isVerticalLayout) return 680; // desktop
        return window.innerHeight * 0.70; // mobile
    };

    const startIconRotation = isVerticalLayout ? "rotate-90" : "";
    const endIconRotation = isVerticalLayout ? "-rotate-90" : "rotate-180";

    const scrollToStep = (i: number, closingIndex: number) => {
        const stepElement = stepRefs.current[i];
        if (!stepElement) return;

        const headerElement =
            document.querySelector<HTMLElement>("[data-site-header]");

        const headerHeight =
            headerElement?.getBoundingClientRect().height ?? 0;

        const closingPanelHeight =
            closingIndex !== -1 && closingIndex < i
                ? panelRefs.current[closingIndex]?.getBoundingClientRect().height ?? 0
                : 0;

        const targetTop =
            window.scrollY +
            stepElement.getBoundingClientRect().top -
            closingPanelHeight -
            headerHeight -
            8;

        window.scrollTo({
            top: Math.max(0, targetTop),
            behavior: "smooth",
        });
    };

    const handleSelect = (i: number) => {
        if (i === selectedIndexRef.current) return;

        hasUserInteractedRef.current = true;

        const sizeProperty = isVerticalLayout ? "height" : "width";
        const openSize = isVerticalLayout ? getOpenHeight() : getOpenWidth();
        const previousIndex = selectedIndexRef.current;

        selectedIndexRef.current = i;

        setColorsIndex(i);

        if (isVerticalLayout) {
            scrollToStep(i, previousIndex);
        }

        gsap.killTweensOf(panelRefs.current);
        gsap.killTweensOf(iconRefs.current);
        gsap.killTweensOf(textRefs.current);

        panelRefs.current.forEach((panel, panelIndex) => {
            if (!panel) return;

            gsap.to(panel, {
                [sizeProperty]: panelIndex === i ? openSize : 0,
                duration: 0.5,
                ease: "power2.inOut",
                onComplete: panelIndex === i
                    ? () => {
                        if (selectedIndexRef.current === i) {
                            setActive(i);
                        }
                    }
                    : undefined,
            });
        });

        iconRefs.current.forEach((icon, iconIndex) => {
            if (!icon) return;
            gsap.to(icon, { opacity: iconIndex === i ? 0 : 1, duration: 0.5 });
        });

        textRefs.current.forEach((text, textIndex) => {
            if (!text) return;
            gsap.to(text, { opacity: textIndex === i ? 1 : 0, duration: 0.5 });
        });
    };

    return (
        <div ref={containerRef} className={`flex overflow-hidden border-x border-t border-border ${isVerticalLayout ? "flex-col" : "flex-row"
            }`}
        >
            <style>{`
            @keyframes vertical-marquee {
                from { transform: translateY(0); }
                to { transform: translateY(-50%); }
            }
            .animate-vertical-marquee {
                animation: vertical-marquee 10s linear infinite;
            }
            
            @keyframes horizontal-marquee {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
            }

            .animate-horizontal-marquee {
                animation: horizontal-marquee 10s linear infinite;
        }
            `}</style>
            {steps.map((step, i) => (
                <div
                    key={i}
                    ref={(el) => {
                        stepRefs.current[i] = el;
                    }}
                    className={`flex ${isVerticalLayout ? "flex-col" : "flex-row"}`}
                >
                    <button
                        type="button"
                        onClick={() => handleSelect(i)}
                        className={`cursor-pointer relative flex shrink-0 items-start overflow-hidden border-border pt-0 md:pt-6 ${isVerticalLayout
                            ? "h-[100px] w-full border-y"
                            : "h-[680px] w-[100px] border-x"
                            }`}
                    >

                        <div
                            ref={(el) => { iconRefs.current[i] = el; }}
                            className={`pointer-events-none absolute inset-0 z-0 flex items-center justify-center gap-5 ${isVerticalLayout ? "flex-row" : "flex-col"
                                }`}
                            style={{ opacity: i === active ? 0 : 1 }}
                        >
                            <img loading="lazy" decoding="async"
                                src="/invertedtriangle.svg"
                                alt=""
                                className={`h-3 w-3 opacity-20 ${startIconRotation}`}
                            />
                            <img loading="lazy" decoding="async"
                                src="/invertedtriangle.svg"
                                alt=""
                                className={`h-3 w-3 opacity-60 ${startIconRotation}`}
                            />
                            <img loading="lazy" decoding="async"
                                src="/invertedtriangle.svg"
                                alt=""
                                className={`h-3 w-3 ${startIconRotation}`}
                            />
                            <img loading="lazy" decoding="async"
                                src="/Group_3.svg"
                                alt=""
                                className={`h-5 w-[18px] ${startIconRotation}`}
                            />
                            <img loading="lazy" decoding="async"
                                src="/invertedtriangle.svg"
                                alt=""
                                className={`h-3 w-3 ${endIconRotation}`}
                            />
                            <img loading="lazy" decoding="async"
                                src="/invertedtriangle.svg"
                                alt=""
                                className={`h-3 w-3 opacity-60 ${endIconRotation}`}
                            />
                            <img loading="lazy" decoding="async"
                                src="/invertedtriangle.svg"
                                alt=""
                                className={`h-3 w-3 opacity-20 ${endIconRotation}`}
                            />
                        </div>

                        <div
                            ref={(el) => { textRefs.current[i] = el; }}
                            className={`pointer-events-none absolute z-0 overflow-hidden ${isVerticalLayout
                                ? "inset-y-0 left-[100px] right-0"
                                : "inset-0"}`}
                            style={{
                                opacity: i === active ? 1 : 0,
                                maskImage: isVerticalLayout
                                    ? "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)"
                                    : "linear-gradient(to bottom, transparent 20%, black 55%, black 85%, transparent)",
                                WebkitMaskImage: isVerticalLayout
                                    ? "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)"
                                    : "linear-gradient(to bottom, transparent 20%, black 55%, black 85%, transparent)",
                            }}
                        >
                            <div className={`flex w-max ${isVerticalLayout
                                ? "animate-horizontal-marquee h-full flex-row items-center"
                                : "animate-vertical-marquee flex-col items-center"
                                }`} >
                                {Array.from({ length: 12 }).map((_, j) => (
                                    <div
                                        className={`flex items-center justify-center ${isVerticalLayout ? "h-full w-40" : "h-40 w-26"
                                            }`}
                                        key={j}>
                                        <span
                                            className={`whitespace-nowrap text-[13px] tracking-[0.6px] text-foreground-muted ${isVerticalLayout ? "" : "-rotate-90"
                                                }`}
                                            style={{ fontFamily: "var(--font-number)" }}
                                        >
                                            {verticalText}
                                        </span>
                                    </div>

                                ))}
                            </div>
                        </div>

                        <div>
                            <span
                                style={{
                                    fontFamily: "var(--font-number)",
                                    fontWeight: 100,
                                    fontSize: "120px",
                                    lineHeight: "1.15",
                                    letterSpacing: "-0.05em",
                                    marginLeft: "-0.25em",
                                    textBoxTrim: "trim-both",
                                    textBoxEdge: " cap alphabetic",
                                }}
                                className={`relative z-10 transition-colors duration-700 ${i === colorsIndexs ? "text-primary" : "text-secondary"}`}
                            >
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div
                                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10"
                                style={{ background: "linear-gradient(90deg, var(--background) 0%, transparent 100%)" }}
                            />
                        </div>
                    </button>
                    <div
                        ref={(el) => { panelRefs.current[i] = el; }}
                        className={`relative shrink-0 overflow-hidden border-border bg-background ${isVerticalLayout
                            ? "h-0 w-full border-b"
                            : "h-[680px] border-r last:border-r-0"
                            }`}
                        style={
                            isVerticalLayout ? {
                                width: "100%",
                                height: i === active ? `${window.innerHeight * 0.70}px` : "0px",
                                maxHeight: "70vh",
                            } : {
                                width: i === active ? `${horizontalPanelWidth}px` : "0px",
                            }}
                    >
                        <div className={`flex h-full w-full flex-col gap-10 p-6 md:p-16 ${isVerticalLayout ? "items-start" : "items-end"
                            }`}>
                            <div className={`relative z-10 ${isVerticalLayout ? "w-full" : "w-[520px]"
                                }`}>
                                <span className="mb-4 block h-[2px] w-10 bg-foreground" />
                                <p
                                    ref={(el) => { descRefs.current[i] = el; }}
                                    className="mb-3 text-[28px] font-medium leading-[1.15] tracking-[-1.4px] text-foreground md:text-4xl md:tracking-[-1.44px]"
                                    style={{ fontFamily: "var(--font-heading)" }}>
                                    {step.description}
                                </p>
                                <span
                                    className="text-[10px] font-medium leading-[1.2] text-foreground-muted md:text-xs"
                                    style={{ fontFamily: "var(--font-number)" }}
                                >
                                    {verticalText}
                                </span>
                            </div>

                            <div
                                className={`absolute bottom-0 right-0 bg-popover-foreground ${isVerticalLayout
                                    ? "aspect-[584/254] w-full"
                                    : "h-[254px] w-[584px]"
                                    }`}
                                style={{ clipPath: "polygon(0% 75.41%, 0% 100%, 100% 100%, 100% 75.41%, 49.56% 0%)" }}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LearningJourney;
