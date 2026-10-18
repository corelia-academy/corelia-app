import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

type FaqItem = { question: string, answer: string };

const Faq = ({ items }: { items: FaqItem[] }) => {
  const [active, setActive] = useState<number | null>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const iconClosedRefs = useRef<(HTMLImageElement | null)[]>([]);
  const iconOpenRefs = useRef<(HTMLImageElement | null)[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  // kéo chuột cuộn (carousel dọc)
  const isDragging = useRef(false);
  const dragMoved = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    isDragging.current = true;
    dragMoved.current = false;
    startY.current = e.pageY;
    startScrollTop.current = trackRef.current.scrollTop;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !trackRef.current) return;
      const delta = e.pageY - startY.current;
      if (Math.abs(delta) > 5) dragMoved.current = true;
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

  const scrollActiveFaqIntoView = (index: number) => {
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

  useEffect(() => {
    items.forEach((_, idx) => {
      gsap.set(iconClosedRefs.current[idx], { opacity: 1, scale: 1, rotate: 0 });
      gsap.set(iconOpenRefs.current[idx], { opacity: 0, scale: 0.5, rotate: 90 });
    });
  }, []);

  // đóng/mở 1 câu hỏi
  const handleSelect = (i: number) => {
    if (dragMoved.current) return;
    const wasOpen = active === i;

    if (active !== null && active !== i) {
      gsap.to(panelRefs.current[active], { height: 0, duration: 0.5, ease: "power2.inOut" });
      gsap.to(iconOpenRefs.current[active], { opacity: 0, duration: 0.5, scale: 0.5, rotate: 90 });
      gsap.to(iconClosedRefs.current[active], { opacity: 1, duration: 0.5, scale: 1, rotate: 0 });
    }

    const panel = panelRefs.current[i];
    if (panel) {
      if (wasOpen) {
        gsap.to(panel, { height: 0, duration: 0.5, ease: "power2.inOut" });
      } else {
        gsap.to(panel, {
          height: panel.scrollHeight,
          duration: 0.5,
          ease: "power2.inOut",
          onComplete: () => {
            scrollActiveFaqIntoView(i);
          },
        });
      }
    }
    gsap.to(iconOpenRefs.current[i], { opacity: wasOpen ? 0 : 1, duration: 0.5, scale: wasOpen ? 0.5 : 1, rotate: wasOpen ? 90 : 0 });
    gsap.to(iconClosedRefs.current[i], { opacity: wasOpen ? 1 : 0, duration: 0.5, scale: wasOpen ? 1 : 0.5, rotate: wasOpen ? 0 : -90 });
    setActive(wasOpen ? null : i);
  };

  return (
    <div
    ref={trackRef}
    onMouseDown={handleMouseDown}
    className="max-h-[680px] cursor-grab select-none overflow-y-auto active:cursor-grabbing">
      {items.map((item, i) => (
        <div
        ref={(el) => { itemRefs.current[i] = el; }}
        key={i}
        className="border-b border-border last:border-b-0">
          <button
          type="button"
          onClick={() => handleSelect(i)}
          className="flex min-h-[128px] w-full cursor-pointer items-center justify-between gap-10 p-6 text-left">
            <p
            className={`text-base font-medium leading-[1.15] transition-colors duration-300 md:text-xl md:leading-[1.2] ${ active === i ? "text-foreground" : "text-foreground-subtle"}`}
            style={{ fontFamily: "var(--font-heading)" }}>
              {item.question}
            </p>
            <div className="relative size-8 shrink-0">
              <img loading="lazy" decoding="async"
              ref={(el) => { iconClosedRefs.current[i] = el; }}
              src="/Group_2.svg"
              alt=""
              className="absolute inset-0 size-8"
              
              />
              <img loading="lazy" decoding="async"
              ref={(el) => { iconOpenRefs.current[i] = el; }}
              src="/Group_3.svg"
              alt=""
              className="absolute inset-0 size-8"
              
              />
            </div>
            {/* <img loading="lazy" decoding="async" src={active === i ? "/Group_3.svg" : "/Group_2.svg" } alt="" className="size-8 shrink-0" /> */}
          </button>
          <div
          ref={(el) => { panelRefs.current[i] = el; }}
          className="h-0 overflow-hidden items-center bg-card">
            <p className="px-10 items-center p-5 text-sm font-normal leading-[1.4] text-foreground md:text-base">
              {item.answer}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Faq;

