import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useAutoPlay } from "@/hooks/useAutoPlay";

type Mentor = { name: string; title: string; photo: string };

const HEXAGON_CLIP = "polygon(100% 0%, 0% 0%, 0% 70.9%, 50.44% 100%, 100% 70.9%)";

// dieu chinh kich co cua mentor + background yellow
const MOBILE_PHOTO_SCALE = 0.78;

const PHOTO_SCALE = typeof window !== "undefined" && window.innerWidth < 768 ? MOBILE_PHOTO_SCALE : 1.0;
const FRAME_W = 301 * PHOTO_SCALE;
const FRAME_H = 360 * PHOTO_SCALE;
const MASK_TOP = 21 * PHOTO_SCALE;
const MASK_H = 339 * PHOTO_SCALE;

const MentorsCarousel = ({ mentors }: { mentors: Mentor[] }) => {
    const [index, setIndex] = useState(0);
    const photoRef = useRef<HTMLDivElement>(null);

    const goTo = (newIndex: number) => {
        gsap.to(photoRef.current, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                setIndex(newIndex);
                gsap.to(photoRef.current, {opacity: 1, duration: 0.3 });
            },
        });
    };

    const next = () => goTo((index + 1) % mentors.length);
    const prev = () => goTo((index - 1 + mentors.length) % mentors.length);
    const mentor = mentors[index];

    const wrapperRef = useRef<HTMLDivElement>(null);
    useAutoPlay(next, 5000, wrapperRef);

    return (
        <div ref={wrapperRef} className="flex h-full w-full flex-col">
            <div className="flex min-h-(min(40vw,240px)) flex-col items-center justify-center gap-8 py-6">
                <div ref={photoRef} className="flex flex-col items-center gap-8">
                <div
                className="relative"
                style={{ width: FRAME_W, height: FRAME_H }}
                >
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 301 360" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M301 136.357V63H247V107.325L151.558 170.434L54 107.046V63H0V136.357L151.818 235L301 136.357Z" fill="var(--warning)" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M301 261.357V188H0V261.357L151.818 360L301 261.357Z" fill="var(--warning)" />
                        <path d="M96 35.1959L150.977 0L205 35.1959V89.2598L150.977 125L96 89.2598V35.1959Z" fill="var(--warning)" />
                    </svg>

                    <div
                    className="absolute left-0 overflow-hidden"
                    style={{  top: MASK_TOP, height: MASK_H, width: FRAME_W, clipPath: HEXAGON_CLIP }}>
                        <img loading="lazy" decoding="async" src={mentor.photo} alt={mentor.name} className="h-full w-full object-cover"/>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 px-5">
                    <span className="mb-3 h-[2px] w-10 bg-foreground" />
                    <p className="text-2xl font-medium leading-[1.15] tracking-[-0.96px] text-foreground md:text-[28px] md:tracking-[-1.12px]"
                    style={{ fontFamily: "var(--font-heading)" }}>
                        {mentor.name}
                    </p>
                    <p className="text-center text-sm font-normal leading-[1.4] text-foreground-muted md:text-base">
                        {mentor.title}
                    </p>
                </div>
                </div>
            </div>

            <div className="relative flex h-[120px] md:h-[200px] items-center justify-center border-t border-border bg-border">
                <img loading="lazy" decoding="async" src="/Corelia_Academy_Logo_Dark.png" alt="Corelia Academy" className="h-[30px] md:h-16 w-auto scale-[1.5] md:scale-none"/>
                <span className="absolute left-3 top-3 size-[6px] bg-foreground-muted" />
                <span className="absolute right-3 top-3 size-[6px] bg-foreground-muted" />
                <span className="absolute bottom-3 left-3 size-[6px] bg-foreground-muted" />
                <span className="absolute bottom-3 right-3 size-[6px] bg-foreground-muted" />
            </div>

            <div className="flex items-stretch border-t border-border bg-popover">
                <button
                type="button"
                onClick={prev}
                aria-label="Previous mentor"
                className="flex flex-1 cursor-pointer items-center border-r border-border px-10 py-6"
                >
                    <img loading="lazy" decoding="async" src="/Prev.svg" alt="" className="size-8" />
                </button>
                <button
                type="button"
                onClick={next}
                aria-label="Next mentor"
                className="flex flex-1 cursor-pointer items-center justify-end px-10 py-6"
                >
                    <img loading="lazy" decoding="async" src="/Next.svg" alt="" className="size-8" />
                </button>
            </div>
        </div>
    );
};

export default MentorsCarousel;
