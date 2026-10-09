// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gsap } from "gsap";
import { GsapAnimationController } from "@/components/animations/GsapAnimationController";

vi.mock("gsap", () => ({
  gsap: {
    to: vi.fn(),
    set: vi.fn(),
    killTweensOf: vi.fn(),
  },
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const CARD_CLASS = "motion-hover-card";

type MediaQueryMock = {
  media: MediaQueryList;
  setMatches: (matches: boolean) => void;
};

let cleanups: Array<() => void> = [];

function mockMatchMedia(initialMatches: Record<string, boolean> = {}) {
  const queries = new Map<string, MediaQueryMock>();

  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const existing = queries.get(query);
    if (existing) return existing.media;

    let matches = initialMatches[query] ?? false;
    const listeners = new Map<
      EventListenerOrEventListenerObject,
      (event: MediaQueryListEvent) => void
    >();
    const media = {
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.set(
            listener,
            typeof listener === "function"
              ? (event) => listener.call(media, event)
              : (event) => listener.handleEvent(event),
          );
        },
      ),
      removeEventListener: vi.fn(
        (_type: string, listener: EventListenerOrEventListenerObject) => {
          listeners.delete(listener);
        },
      ),
    } as unknown as MediaQueryList;
    const setMatches = (nextMatches: boolean) => {
      matches = nextMatches;
      const event = { matches: nextMatches, media: query } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    };

    queries.set(query, { media, setMatches });
    return media;
  });

  return {
    setMatches(query: string, matches: boolean) {
      queries.get(query)?.setMatches(matches);
    },
  };
}

function dispatchRelatedEvent(
  target: Element,
  type: "pointerover" | "pointerout",
  relatedTarget: EventTarget | null = null,
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
  target.dispatchEvent(event);
}

function mountController() {
  const container = document.createElement("div");
  const cardHost = document.createElement("div");
  const card = document.createElement("article");
  const button = document.createElement("button");
  card.className = CARD_CLASS;
  card.append(button);
  document.body.append(container, cardHost);
  cardHost.append(card);

  const root = createRoot(container);
  act(() => root.render(<GsapAnimationController />));
  let mounted = true;
  const cleanup = () => {
    if (!mounted) return;
    mounted = false;
    act(() => root.unmount());
    container.remove();
    cardHost.remove();
  };
  cleanups.push(cleanup);

  return { card, button, cleanup };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
  cleanups = [];
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("GsapAnimationController", () => {
  it("animates a card on pointer enter and restores it on pointer leave", () => {
    mockMatchMedia({ [FINE_POINTER_QUERY]: true });
    const { card } = mountController();

    dispatchRelatedEvent(card, "pointerover", document.body);
    dispatchRelatedEvent(card, "pointerout", document.body);

    expect(gsap.to).toHaveBeenNthCalledWith(
      1,
      card,
      expect.objectContaining({ y: -4, duration: 0.24 }),
    );
    expect(gsap.to).toHaveBeenNthCalledWith(
      2,
      card,
      expect.objectContaining({ y: 0, duration: 0.18 }),
    );
    expect(vi.mocked(gsap.to).mock.calls[0]?.[1]).not.toHaveProperty("scale");
  });

  it("does not restart the animation when the pointer moves within a card", () => {
    mockMatchMedia({ [FINE_POINTER_QUERY]: true });
    const { card, button } = mountController();

    dispatchRelatedEvent(button, "pointerover", card);

    expect(gsap.to).not.toHaveBeenCalled();
  });

  it("animates keyboard-visible focus and skips pointer animation on coarse devices", () => {
    mockMatchMedia();
    const { card, button } = mountController();
    const originalMatches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (
      this: Element,
      selector: string,
    ) {
      if (selector === ":focus-visible") return true;
      return originalMatches.call(this, selector);
    });

    dispatchRelatedEvent(card, "pointerover", document.body);
    button.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(gsap.to).toHaveBeenCalledTimes(1);
    expect(gsap.to).toHaveBeenCalledWith(
      card,
      expect.objectContaining({ y: -4 }),
    );
  });

  it("clears the transform when reduced motion becomes enabled", () => {
    const mediaQueries = mockMatchMedia({ [FINE_POINTER_QUERY]: true });
    const { card } = mountController();
    dispatchRelatedEvent(card, "pointerover", document.body);

    mediaQueries.setMatches(REDUCED_MOTION_QUERY, true);

    expect(gsap.killTweensOf).toHaveBeenCalledWith(card);
    expect(gsap.set).toHaveBeenCalledWith(card, { clearProps: "transform" });
  });

  it("removes delegated listeners and clears card transforms on unmount", () => {
    mockMatchMedia();
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { card, cleanup } = mountController();

    cleanup();

    expect(removeListener).toHaveBeenCalledWith("pointerover", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("pointerout", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(removeListener).toHaveBeenCalledWith("focusout", expect.any(Function));
    expect(gsap.killTweensOf).toHaveBeenCalledWith(card);
    expect(gsap.set).toHaveBeenCalledWith(card, { clearProps: "transform" });
  });
});
