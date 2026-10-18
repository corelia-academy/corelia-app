import { useCallback, useEffect, useRef } from "react";
import type { Swiper as SwiperInstance } from "swiper/types";

type UseSwiperCarouselOptions = {
    itemSelector?: string;
    revealItem?: (item: HTMLElement) => void;
    hideItem?: (item: HTMLElement) => void;
};

export function useSwiperCarousel({
    itemSelector = "[data-swiper-card]",
    revealItem,
    hideItem,
}: UseSwiperCarouselOptions = {}) {
    const swiperRef = useRef<SwiperInstance | null>(null);
    const activeTouchItemRef = useRef<HTMLElement | null>(null);

    const stopAutoplay = useCallback(() => {
        swiperRef.current?.autoplay?.stop();
    }, []);

    const startAutoplay = useCallback(() => {
        swiperRef.current?.autoplay?.start();
    }, []);

    const closeActiveTouchItem = useCallback(
        (restartAutoplay = false) => {
            const activeItem = activeTouchItemRef.current;

            if (activeItem) {
                hideItem?.(activeItem);
                activeTouchItemRef.current = null;
            }

            if (restartAutoplay) {
                startAutoplay();
            }
        },
        [hideItem, startAutoplay],
    );

    const handleSwiper = useCallback((swiper: SwiperInstance) => {
        swiperRef.current = swiper;
    }, []);

    const handleTap = useCallback(
        (
            swiper: SwiperInstance,
            event: MouseEvent | TouchEvent | PointerEvent,
        ) => {
            const isMouseEvent =
                "pointerType" in event
                    ? event.pointerType === "mouse"
                    : event instanceof MouseEvent;

            if (isMouseEvent) return;

            const clickedSlide = swiper.clickedSlide as HTMLElement | null;

            if (!clickedSlide) return;

            const clickedItem = clickedSlide.matches(itemSelector)
                ? clickedSlide
                : clickedSlide.querySelector<HTMLElement>(itemSelector);

            if (!clickedItem) return;

            if (activeTouchItemRef.current === clickedItem) {
                hideItem?.(clickedItem);
                activeTouchItemRef.current = null;
                startAutoplay();
                return;
            }

            if (activeTouchItemRef.current) {
                hideItem?.(activeTouchItemRef.current);
            }

            revealItem?.(clickedItem);
            activeTouchItemRef.current = clickedItem;
            stopAutoplay();
        },
        [
            hideItem,
            itemSelector,
            revealItem,
            startAutoplay,
            stopAutoplay,
        ],
    );

    const handleSliderFirstMove = useCallback(() => {
        closeActiveTouchItem(false);
    }, [closeActiveTouchItem]);

    const handleTouchEnd = useCallback(() => {
        if (!activeTouchItemRef.current) {
            startAutoplay();
        }
    }, [startAutoplay]);

    const handleSlideChange = useCallback(() => {
        closeActiveTouchItem(false);
    }, [closeActiveTouchItem]);

    const slideNext = useCallback(() => {
        closeActiveTouchItem(false);
        swiperRef.current?.slideNext();
        startAutoplay();
    }, [closeActiveTouchItem, startAutoplay]);

    const slidePrev = useCallback(() => {
        closeActiveTouchItem(false);
        swiperRef.current?.slidePrev();
        startAutoplay();
    }, [closeActiveTouchItem, startAutoplay]);

    useEffect(() => {
        return () => {
            swiperRef.current = null;
            activeTouchItemRef.current = null;
        };
    }, []);

    return {
        swiperRef,
        activeTouchItemRef,
        handleSwiper,
        handleTap,
        handleSliderFirstMove,
        handleTouchEnd,
        handleSlideChange,
        slideNext,
        slidePrev,
        stopAutoplay,
        startAutoplay,
        closeActiveTouchItem,
    };
}