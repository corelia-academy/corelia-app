import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { A11y, Autoplay } from "swiper/modules";
import { useSwiperCarousel } from "@/hooks/useSwiperCarousel";

import "swiper/css";
import "swiper/css/a11y";

// import { gsap } from "gsap";
// import { useAutoPlay } from "@/hooks/useAutoPlay";

const HeroCarousel = ({ images }: { images: string[] }) => {
    const [index, setIndex] = useState(0);
    // const imgRef = useRef<HTMLImageElement>(null);
    // const wrapperRef = useRef<HTMLDivElement>(null);

    const { swiperRef, handleSwiper, } = useSwiperCarousel();

    // tai anh truoc
    useEffect(() => {
        images.forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    }, [images]);

    const goTo = (newIndex: number) => {
        swiperRef.current?.slideToLoop(newIndex);
    };

    if (images.length === 0) return null;

    // const next = () => {
    //     if(images.length <= 1) return;
    //     goTo((index + 1) % images.length);
    // };

    // useAutoPlay(next, 5000, wrapperRef);
    return (
        <div className="relative w-full overflow-hidden">
            <Swiper
                modules={[Autoplay, A11y]}
                loop={images.length > 1}
                speed={500}
                slidesPerView={1}
                slidesPerGroup={1}
                allowTouchMove={images.length > 1}
                simulateTouch={true}
                grabCursor={images.length > 1}
                threshold={5}
                touchAngle={45}
                shortSwipes={true}
                longSwipes={true}
                longSwipesRatio={0.25}
                preventClicks={true}
                preventClicksPropagation={true}
                autoplay={
                    images.length > 1 ? {
                        delay: 5000,
                        disableOnInteraction: false,
                        pauseOnMouseEnter: true,
                    } : false
                }
                onSwiper={handleSwiper}
                onSlideChange={(swiper) => {
                    setIndex(swiper.realIndex);
                }}
                className="w-full"
            >
                {images.map((src, imagesIndex) => (
                    <SwiperSlide key={`${src}-${imagesIndex}`}>
                        <img
                            src={src}
                            alt=""
                            draggable={false}
                            className="block w-full h-full"
                        />
                    </SwiperSlide>
                ))}
            </Swiper>
            {images.length > 1 && (
                <div className="absolute bottom-[52px] left-1/2 -translate-x-1/2 gap-[10px] z-10 hidden md:flex">
                    {images.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            aria-label={`Slide ${i + 1}`}
                            onClick={() => goTo(i)}
                            className={`h-[5px] w-10 rounded-full transition-colors ${i === index ? "bg-primary-foreground" : "bg-primary-foreground/30"
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default HeroCarousel;