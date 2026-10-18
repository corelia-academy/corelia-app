import { gsap } from "gsap";

const CLAMPED_HEIGHT = 112; //px

export function initTestimonialHover() {
    document.querySelectorAll<HTMLElement>("[data-testimonial-hover]").forEach((wrapper) => {
        const card = wrapper.querySelector<HTMLElement>("[data-testimonial-card]");
        const stripe = wrapper.querySelector<HTMLElement>("[data-testimonial-stripe]");
        const review = wrapper.querySelector<HTMLElement>("[data-testimonial-review]");

        if(!card || !stripe) return;

        const mq = window.matchMedia("(min-width: 768px)");

        gsap.set(card, { x: 0, y: 0 });
        gsap.set(stripe, { scaleY: 0, transformOrigin: "bottom" });

        wrapper.addEventListener("mouseenter", () => {
            if (!mq.matches) return;
            gsap.to(card, { x: 20, y: -20 , duration: 0.3, ease: "power2.out" });
            gsap.to(stripe, { scaleY: 0, duration: 0.3, ease: "power2.out" });
            
            if (review) {
                const fullHeight = review.scrollHeight;
                review.classList.remove("line-clamp-4")
                gsap.fromTo(
                    review,
                    { height: CLAMPED_HEIGHT },
                    { height: fullHeight, duration: 0.3, ease: "power2.out" }
                );
            }
        });

        wrapper.addEventListener("mouseleave", () => {
            if (!mq.matches) return;
            gsap.to(card, { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
            gsap.to(stripe, { scaleY: 1, duration: 0.4, ease: "power2.out" });
            
            if (review) {
                gsap.to(review, {
                    height: CLAMPED_HEIGHT,
                    duration: 0.3,
                    ease: "power2.out",
                    onComplete: () => {
                        gsap.set(review, { clearProps: "height" });
                        review.classList.add("line-clamp-4");
                    },
                });
            }
        });
    });
}