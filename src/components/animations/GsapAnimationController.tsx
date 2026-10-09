import { useEffect } from "react";
import { gsap } from "gsap";

const HOVER_PRESETS = {
  "motion-hover-card": {
    enter: { y: -4, duration: 0.24 },
    leave: { y: 0, duration: 0.18 },
  },
} as const;

const HOVER_CLASSES = Object.keys(HOVER_PRESETS) as Array<keyof typeof HOVER_PRESETS>;
const ANIMATION_SELECTOR = HOVER_CLASSES
  .map((className) => `.${className}`)
  .join(", ");

function isWithinElement(element: HTMLElement, target: EventTarget | null) {
  return target instanceof Node && element.contains(target);
}

function findAnimatedElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(ANIMATION_SELECTOR);
}

function getHoverPreset(element: HTMLElement) {
  const className = HOVER_CLASSES.find((name) =>
    element.classList.contains(name),
  );

  return className ? HOVER_PRESETS[className] : null;
}

function animateElement(element: HTMLElement, active: boolean) {
  const preset = getHoverPreset(element);
  if (!preset) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.killTweensOf(element);
    gsap.set(element, { clearProps: "transform" });
    return;
  }

  gsap.to(element, {
    ...(active ? preset.enter : preset.leave),
    ease: "power2.out",
    overwrite: "auto",
  });
}

function isPointerHovering(element: HTMLElement) {
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    element.matches(":hover")
  );
}

export function GsapAnimationController() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    const handlePointerOver = (event: PointerEvent) => {
      const element = findAnimatedElement(event.target);
      if (!element || isWithinElement(element, event.relatedTarget)) return;
      if (!finePointer.matches) return;
      animateElement(element, true);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const element = findAnimatedElement(event.target);
      if (!element || isWithinElement(element, event.relatedTarget)) return;
      if (!element.matches(":focus-within")) animateElement(element, false);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const element = findAnimatedElement(event.target);
      if (element && event.target instanceof Element && event.target.matches(":focus-visible")) {
        animateElement(element, true);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const element = findAnimatedElement(event.target);
      if (!element || isWithinElement(element, event.relatedTarget)) return;
      if (!isPointerHovering(element)) animateElement(element, false);
    };

    const clearTransformsForReducedMotion = (event: MediaQueryListEvent) => {
      if (!event.matches) return;

      document.querySelectorAll<HTMLElement>(ANIMATION_SELECTOR).forEach((element) => {
        gsap.killTweensOf(element);
        gsap.set(element, { clearProps: "transform" });
      });
    };

    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    reducedMotion.addEventListener("change", clearTransformsForReducedMotion);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      reducedMotion.removeEventListener("change", clearTransformsForReducedMotion);
      document.querySelectorAll<HTMLElement>(ANIMATION_SELECTOR).forEach((element) => {
        gsap.killTweensOf(element);
        gsap.set(element, { clearProps: "transform" });
      });
    };
  }, []);

  return null;
}
