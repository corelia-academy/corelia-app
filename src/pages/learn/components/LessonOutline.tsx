import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ListBullets } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuItemContent, DropdownMenuList, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LEARN_MENU_CONTENT, LEARN_MENU_ITEM } from "./LearnFooterMenu";

gsap.registerPlugin(ScrollToPlugin);

const SCROLL_OFFSET = 24;

type OutlineItem = { el: HTMLElement; text: string; level: 2 | 3 | 4 };

const sameItems = (a: OutlineItem[], b: OutlineItem[]) =>
  a.length === b.length && a.every((item, i) => item.el === b[i].el && item.text === b[i].text);

/** Headings of a lesson body, only when the lesson is taller than its scroll area (more than one page). */
function useLessonOutline(bodyRef: RefObject<HTMLElement | null>, lessonId: string) {
  const [items, setItems] = useState<OutlineItem[]>([]);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    const viewport = body?.closest("main");
    if (!body || !viewport) return;
    const measure = () => {
      const headings = Array.from(body.querySelectorAll<HTMLElement>("h2, h3, h4")).filter(heading => heading.textContent?.trim());
      const longerThanOnePage = viewport.scrollHeight > viewport.clientHeight + 1;
      const next = longerThanOnePage && headings.length >= 2
        ? headings.map(el => ({ el, text: el.textContent!.trim(), level: Number(el.tagName[1]) as OutlineItem["level"] }))
        : [];
      // Keep the same list when nothing changed, so the menu does not re-render for nothing.
      setItems(previous => (sameItems(previous, next) ? previous : next));
    };
    // Measured before the first paint, so Content arrives with the lesson instead of popping in a frame later and pushing Ask AI sideways.
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [bodyRef, lessonId]);
  return items;
}

/** Which heading the reader is at: the last one that has reached the top of the lesson. */
function useActiveHeading(items: OutlineItem[]) {
  const [active, setActive] = useState(0);
  const jumpingRef = useRef(false);
  useEffect(() => {
    const viewport = items[0]?.el.closest("main");
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (jumpingRef.current) return; // while a jump scrolls past other headings, keep the chosen one lit
      const line = viewport.getBoundingClientRect().top + SCROLL_OFFSET + 1;
      let current = 0;
      items.forEach((item, index) => { if (item.el.getBoundingClientRect().top <= line) current = index; });
      setActive(current);
    };
    const onScroll = () => { frame ||= requestAnimationFrame(update); };
    frame = requestAnimationFrame(update);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener("scroll", onScroll); };
  }, [items]);
  // `pick` lights the chosen item at once; `settle` hands control back to the scroll position.
  const pick = (index: number) => { jumpingRef.current = true; setActive(index); };
  const settle = () => { jumpingRef.current = false; };
  return { active, pick, settle };
}

function OutlineMenu({ items, active, onPick, onSettled }: { items: OutlineItem[]; active: number; onPick: (index: number) => void; onSettled: () => void }) {
  const { t } = useTranslation("courses");
  const go = (item: OutlineItem, index: number) => {
    const viewport = item.el.closest("main");
    if (!viewport) return;
    onPick(index); // lights the chosen item at once
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.to(viewport, { scrollTo: { y: item.el, offsetY: SCROLL_OFFSET }, duration: still ? 0 : 0.6, ease: "power3.out", onComplete: onSettled, onInterrupt: onSettled });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="cta" hierarchy="tertiary" size="small" className="px-3" trailingIcon={<ListBullets weight="duotone" aria-hidden />} />}>
        {t("learning.outline")}
      </DropdownMenuTrigger>
      <DropdownMenuContent layout="multiple-list" side="top" align="start" className={cn("w-72", LEARN_MENU_CONTENT)}>
        <DropdownMenuList>
          {items.map((item, index) => (
            <DropdownMenuItem
              key={index}
              aria-current={index === active ? "true" : undefined}
              ref={index === active ? (el: HTMLElement | null) => el?.scrollIntoView?.({ block: "nearest" }) : undefined}
              className={cn(LEARN_MENU_ITEM, item.level === 3 && "pl-xl", item.level === 4 && "pl-3xl", index === active && "bg-dropdown-hover [&_[data-slot=dropdown-menu-item-title]]:text-primary")}
              onClick={() => go(item, index)}
            >
              <DropdownMenuItemContent>{item.text}</DropdownMenuItemContent>
            </DropdownMenuItem>
          ))}
        </DropdownMenuList>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The "Content" table of contents in the lesson footer. It renders nothing when the lesson fits on one page. */
export function LessonOutline({ bodyRef, lessonId, withDivider }: { bodyRef: RefObject<HTMLElement | null>; lessonId: string; withDivider: boolean }) {
  const items = useLessonOutline(bodyRef, lessonId);
  const { active, pick, settle } = useActiveHeading(items);
  if (!items.length) return null;
  // Portals add their content in the order it appears, so Content would land after Ask AI.
  // `order-first` keeps it at the start of the footer slot, as in Figma.
  return (
    <div className="order-first flex items-center gap-xs">
      <OutlineMenu
        items={items}
        active={Math.min(active, items.length - 1)}
        onPick={pick}
        onSettled={settle}
      />
      {withDivider && <span aria-hidden className="h-8 w-px bg-border" />}
    </div>
  );
}
