import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useAutoPlay } from "@/hooks/useAutoPlay";
import cardCaseStudy from "@/assets/casestudy/cardcasestudy.png";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const STATS_AUTO_SCROLL_SPEED = 42;

type CaseStudy = {
    eyebrow: string;
    navLabel: string;
    title: string;
    description: string;
    href: string;
    image: string | null;
};

type StatItem = {
    number: string;
    text: string;
};

type Props = {
    items: CaseStudy[];
    stats: StatItem[];
    viewFullLabel: string;
};
export default function BusinessCaseStudiesCarousel({
    items,
    stats,
    viewFullLabel,
}: Props) {
    const [activeIndex, setActiveIndex] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const statsRef = useRef<HTMLDivElement>(null);
    const statsTrackRef = useRef<HTMLDivElement>(null);
    const eyebrowRef = useRef<HTMLParagraphElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const descriptionRef = useRef<HTMLParagraphElement>(null);
    const changeCard = (nextIndex: number) => {
        if (nextIndex === activeIndex) return;
        setActiveIndex(nextIndex);
    };

    useEffect(() => {
        items.forEach(({ image }) => {
            if (!image) return;

            const preloader = new Image();
            preloader.src = image;
            preloader.decode?.().catch(() => undefined);
        });
    }, [items]);

    const next = () => {
        changeCard((activeIndex + 1) % items.length);
    };
    const selectCard = (index: number) => {
        changeCard(index);
    };

    useAutoPlay(next, 7000, wrapperRef);
    useIsoLayoutEffect(() => {
        const contentElements = [
            eyebrowRef.current,
            titleRef.current,
            descriptionRef.current,
        ].filter(Boolean) as HTMLElement[];

        const animation = gsap.fromTo(
            contentElements,
            { y: 8, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                duration: 0.24,
                stagger: 0.025,
                ease: "power1.out",
                clearProps: "transform,opacity",
            },
        );

        return () => {
            animation.kill();
        };
    }, [activeIndex]);

    useEffect(() => {
        const el = statsRef.current;
        const track = statsTrackRef.current;
        if (!el || !track || stats.length <= 1) return;

        const observer = new IntersectionObserver(([entry]) => {
            track.classList.toggle("is-running", entry.isIntersecting);
        }, { rootMargin: "100px" });

        observer.observe(el);

        return () => {
            observer.disconnect();
            track.classList.remove("is-running");
        };
    }, [stats.length]);

    const activeCard = items[activeIndex];

    if (!activeCard) return null;

    const previousIndex = (activeIndex - 1 + items.length) % items.length;
    const nextIndex = (activeIndex + 1) % items.length;

    const previousCard = items[previousIndex];
    const nextCard = items[nextIndex];
    const statsMarqueeDuration = (stats.length * 80) / STATS_AUTO_SCROLL_SPEED;

    const renderStats = (duplicate: boolean) => stats.map((stat, index) => (
        <div
            key={`${stat.number}-${stat.text}-${duplicate ? "duplicate" : "primary"}-${index}`}
            data-stat-card
            className="grid h-[72px] shrink-0 grid-cols-[100px_1fr] items-center gap-0 md:gap-7"
        >
            <div data-stat-content className="shrink-0">
                <div
                    className="font-medium text-[28px] leading-[1.15] tracking-[-1.4px] text-foreground md:text-4xl md:tracking-[-1.44px]"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    {stat.number}
                </div>

                <div className="mt-3 h-px w-12 bg-foreground/80" />
            </div>

            <p
                data-stat-content
                className="max-w-[260px] font-medium text-base leading-[1.15] text-foreground md:text-xl md:leading-[1.2]"
                style={{ fontFamily: "var(--font-heading)" }}
            >
                {stat.text}
            </p>
        </div>
    ));

    return (
        <div ref={wrapperRef} className="relative mx-auto border-x border-border w-full">
            <style>{`
                @keyframes business-stats-scroll {
                    from { transform: translateY(0); }
                    to { transform: translateY(calc(-50% - 4px)); }
                }

                .stats-marquee-track.is-running {
                    animation: business-stats-scroll var(--stats-marquee-duration) linear infinite;
                    will-change: transform;
                }

                .stats-marquee-viewport:hover .stats-marquee-track {
                    animation-play-state: paused;
                }

                @media (prefers-reduced-motion: reduce) {
                    .stats-marquee-track.is-running {
                        animation: none;
                    }
                }
            `}</style>
            <nav
                className="grid min-h-[70px] grid-cols-[48px_minmax(0,1fr)_48px] border-b border-border bg-background md:grid-cols-3 xl:grid-cols-[366px_minmax(0,1fr)_366px]"
                aria-label="Case studies"
            >
                <button
                    type="button"
                    onClick={() => selectCard(previousIndex)}
                    className="flex cursor-pointer min-w-0 items-center gap-0 border-r border-border px-2 text-left text-lg leading-[1.15] tracking-[-0.02em] text-foreground-muted transition-colors hover:text-foreground md:gap-3 md:px-8 md:text-2xl md:leading-[1.2]"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    <img loading="lazy" decoding="async"
                        src="/Prev.svg"
                        alt=""
                        aria-hidden="true"
                        className="size-8"
                    />

                    <span className="hidden truncate md:inline">
                        {previousCard.navLabel}
                    </span>
                </button>

                <div
                    aria-current="true"
                    className="flex min-w-0 items-center justify-center bg-primary px-4 text-center text-4xl font-medium leading-[1.15] tracking-[-0.05em] text-primary-foreground md:px-8 md:text-5xl md:tracking-[-0.04em]"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    <span className="truncate">
                        {activeCard.navLabel}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => selectCard(nextIndex)}
                    className="flex cursor-pointer min-w-0 items-center justify-end gap-0 border-l border-border px-2 text-right text-lg leading-[1.15] tracking-[-0.02em] text-foreground-muted transition-colors hover:text-foreground md:gap-3 md:px-8 md:text-2xl md:leading-[1.2]"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    <span className="hidden truncate md:inline">
                        {nextCard.navLabel}
                    </span>

                    <img loading="lazy" decoding="async"
                        src="/Next.svg"
                        alt=""
                        aria-hidden="true"
                        className="size-8"
                    />
                </button>
            </nav>
            <article
                className="relative z-10 grid min-h-[520px] md:min-h-[640px] md:grid-cols-2"
            >
                <div className="flex min-h-[520px] flex-col md:min-h-[640px]">
                    <div className="hidden md:block">
                        <div className="relative flex h-[180px] shrink-0 items-center justify-center border-b border-border ">
                        <div className="flex size-20 items-center justify-center border border-border bg-background">
                            <img loading="lazy" decoding="async"
                                src="/differenticon/df2-dark.svg"
                                alt=""
                                aria-hidden="true"
                                className="size-10"
                            />
                        </div>
                    </div>
                    </div>

                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-background">
                        <img loading="lazy" decoding="async"
                            src={cardCaseStudy.src}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-0 left-0 z-0 h-auto w-[50%] object-contain object-left-bottom"
                        />

                        <div
                            key={activeIndex}
                            className="relative z-10 flex min-h-[250px] flex-col bg-card p-6 md:mx-6 mt-6 mb-3 md:min-h-[290px] md:p-10">
                            <div className="space-y-6">
                                <p
                                    ref={eyebrowRef}
                                    className="text-sm font-medium leading-[1.2] text-foreground-muted md:text-lg"
                                >
                                    {activeCard.eyebrow}
                                </p>

                                <h2 ref={titleRef}
                                    className="max-w-[520px] text-2xl font-medium leading-[1.15] tracking-[-0.03em] text-foreground md:text-[28px] md:leading-[1.2] line-clamp-2"
                                    style={{ fontFamily: "var(--font-heading)" }}
                                >
                                    <a
                                        href={activeCard.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="transition-colors hover:text-primary-a focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                                    >
                                        {activeCard.title}
                                    </a>
                                </h2>

                                <p ref={descriptionRef} className="max-w-[500px] text-[13px] leading-[1.45] text-foreground md:text-sm line-clamp-2">
                                    {activeCard.description}
                                </p>
                            </div>

                        </div>

                        <div
                            ref={statsRef}
                            className="stats-marquee-viewport relative z-10 ml-5 md:ml-auto h-[100px] overflow-y-hidden"
                            style={{
                                maskImage:
                                    "linear-gradient(to bottom, transparent 0%, black 33%, black 67%, transparent 100%)",
                                WebkitMaskImage:
                                    "linear-gradient(to bottom, transparent 0%, black 33%, black 67%, transparent 100%)",
                            }}
                        >
                            <div
                                ref={statsTrackRef}
                                className="stats-marquee-track flex flex-col gap-2 select-none"
                                style={{
                                    "--stats-marquee-duration": `${statsMarqueeDuration}s`,
                                } as React.CSSProperties}
                            >
                                <div className="flex flex-col gap-2">
                                    {renderStats(false)}
                                </div>
                                <div className="flex flex-col gap-2" aria-hidden="true">
                                    {renderStats(true)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative flex flex-col min-h-[min(40vh,280px)] overflow-hidden p-6 md:p-10">
                    <div className="relative min-h-[220px] flex-1 overflow-hidden border border-border">
                        {activeCard.image ? (
                            <img loading="lazy" decoding="async"
                                src={activeCard.image}
                                alt={activeCard.title}
                                decoding="async"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div
                                className="h-full w-full bg-linear-to-br from-primary/20 via-card to-background"
                                aria-hidden="true"
                            />
                        )}
                    </div>
                    <a
                        href={activeCard.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-16 shrink-0 items-center justify-end gap-3 border-x border-b border-border bg-secondary px-6 text-sm font-medium leading-[1.2] text-foreground transition-colors md:px-8 md:text-lg"
                    >
                        <span>{viewFullLabel}</span>
                        <img loading="lazy" decoding="async"
                            src="/invertedtriangle.svg"
                            alt=""
                            aria-hidden="true"
                            className="size-4 -rotate-90"
                        />
                    </a>
                </div>
            </article>

            {/* <div
                className="mt-5 flex items-center justify-center gap-2"
                role="tablist"
                aria-label="Case studies"
            >
                {items.map((item, index) => (
                    <button
                        key={`${item.title}-${index}`}
                        type="button"
                        role="tab"
                        aria-selected={index === activeIndex}
                        aria-label={`Case study ${index + 1}`}
                        onClick={() => selectCard(index)}
                        className={`h-1.5 rounded-full transition-all ${index === activeIndex
                            ? "w-10 bg-foreground"
                            : "w-5 bg-foreground/30"
                            }`}
                    />
                ))}
            </div> */}
        </div>
    );
}
