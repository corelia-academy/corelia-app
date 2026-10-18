import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useAutoPlay } from "@/hooks/useAutoPlay";

type Testimonial = { name: string; role: string; review: string; avatar: string };

const TestimonialCarousel = ({ testimonials }: { testimonials: Testimonial[] }) => {
    const [index, setIndex] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const goTo = (newIndex: number) => {
        gsap.to(contentRef.current, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
                setIndex(newIndex);
                gsap.to(contentRef.current, { opacity: 1, duration: 0.3 });
            },
        });
    };

    const next = () => goTo((index + 1) % testimonials.length);
    const prev = () => goTo((index - 1 + testimonials.length) % testimonials.length);
    const item = testimonials[index];

    useAutoPlay(next, 6000, wrapperRef);

    return (
        <div ref={wrapperRef} className="flex flex-col gap-6">
            <div ref={contentRef} className="flex flex-col gap-6">
                <div className="flex items-center gap-3">
                    <img loading="lazy" decoding="async" src={item.avatar} alt="" className="size-5 shrink-0 rounded-full bg-black/20" />
                    <div>
                        <p className="text-sm font-normal leading-[1.2] md:text-lg">{item.name}</p>
                        <p className="text-sm italic leading-[1.4] opacity-80 md:text-base">{item.role}</p>
                    </div>
                </div>
                <p
                    className="line-clamp-10 text-lg font-normal leading-[1.15] tracking-[-0.36px] xl:text-2xl xl:leading-[1.2] xl:tracking-[-0.48px]"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    {item.review}
                </p>
            </div>
            <div className="absolute bottom-5 flex items-center -translate-x-1/2 left-1/2 gap-3">
                <button type="button" onClick={prev} aria-label="Previous testimonial" className="cursor-pointer">
                    <img loading="lazy" decoding="async" src="/prevtestimonial.svg" alt="" className="size-8" />
                </button>
                <button type="button" onClick={next} aria-label="Next testimonial" className="cursor-pointer">
                    <img loading="lazy" decoding="async" src="/nexttestimonial.svg" alt="" className="size-8" />
                </button>
            </div>
        </div>
    );
};

export default TestimonialCarousel;
