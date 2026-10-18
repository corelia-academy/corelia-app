// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthActions } from "./AuthActions";
import { LanguageMenu } from "./LanguageMenu";
import { SITE_HEADER_COPY, siteNavigation } from "./nav";
import { readSiteSession } from "./session";
import { SiteHeader } from "./SiteHeader";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function render(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const copy = SITE_HEADER_COPY.vi;
const header = (props: Partial<React.ComponentProps<typeof SiteHeader>> = {}) => (
  <SiteHeader
    logo={{ href: "/vi", src: "/logo.svg", alt: "Corelia" }}
    nav={siteNavigation("vi")}
    labels={copy}
    {...props}
  />
);

describe("SiteHeader", () => {
  it("renders localized mega-menu groups with landing links", () => {
    const el = render(header({ activePath: "/vi/jobs" }));
    const triggers = [...el.querySelectorAll<HTMLButtonElement>(".csh-nav-trigger")].map((b) => b.textContent);
    expect(triggers).toEqual(["Học", "Cơ hội", "Cộng đồng", "Giới thiệu"]);
    expect(el.querySelector('a[href="/vi/courses"]')?.textContent).toContain("Khóa học");
    expect(el.querySelector('.csh-nav-trigger[data-active]')?.textContent).toBe("Cơ hội");
    expect(el.querySelector('a[href="/vi/jobs"]')?.getAttribute("aria-current")).toBe("page");
  });

  it("opens a group on click and closes it with Escape", () => {
    const el = render(header());
    const trigger = el.querySelector<HTMLButtonElement>(".csh-nav-trigger")!;
    const panel = document.getElementById(trigger.getAttribute("aria-controls")!)!;
    expect(panel.hidden).toBe(true);
    act(() => trigger.click());
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    act(() => { trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(panel.hidden).toBe(true);
  });

  it("opens the mobile drawer and closes it with Escape", () => {
    const el = render(header());
    const button = el.querySelector<HTMLButtonElement>(".csh-menu-button")!;
    const drawer = document.getElementById(button.getAttribute("aria-controls")!)!;
    act(() => button.click());
    expect(drawer.hidden).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    expect(drawer.hidden).toBe(true);
    expect(document.body.style.overflow).toBe("");
  });

  it("lets the host render links and omit the drawer", () => {
    const renderLink = vi.fn(({ href, children, className }) => <a data-custom href={href} className={className}>{children}</a>);
    const el = render(header({ renderLink, mobileMenu: false, start: <span data-start /> }));
    expect(el.querySelector(".csh-menu-button")).toBeNull();
    expect(el.querySelector("[data-start]")).not.toBeNull();
    expect(el.querySelectorAll("a[data-custom]").length).toBeGreaterThan(5);
  });
});

describe("siteNavigation", () => {
  it("localises catalog sections everywhere and marketing pages only in English and Vietnamese", () => {
    const hrefs = (locale: "ja" | "vi") => siteNavigation(locale).flatMap((g) => g.items ?? []).map((i) => i.href);
    expect(hrefs("ja")).toEqual(["/ja/courses", "/roadmap", "/cora", "/ja/jobs", "/ja/hackathons", "/blog", "/case-studies", "/universities", "/about", "/contact"]);
    expect(hrefs("vi")).toContain("/vi/roadmap");
  });
});

describe("LanguageMenu", () => {
  it("lists every locale by endonym and reports a new choice", () => {
    const onSelect = vi.fn();
    const el = render(<LanguageMenu locale="vi" label="Ngôn ngữ" onSelect={onSelect} />);
    act(() => el.querySelector<HTMLButtonElement>(".csh-icon-button")!.click());
    const options = [...el.querySelectorAll<HTMLButtonElement>(".csh-lang-option")];
    expect(options.map((o) => o.textContent)).toEqual(["English", "Tiếng Việt", "简体中文", "繁體中文", "한국어", "日本語", "Español"]);
    act(() => options[5].click());
    expect(onSelect).toHaveBeenCalledWith("ja");
  });
});

describe("AuthActions", () => {
  const props = { signInHref: "/learn/login", signUpHref: "/learn/login?mode=signup", appHref: "/learn", labels: copy };

  it("shows log in and sign up for guests", () => {
    const el = render(<AuthActions user={null} {...props} />);
    expect([...el.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Đăng nhập", "/learn/login"],
      ["Đăng ký", "/learn/login?mode=signup"],
    ]);
  });

  it("shows the app entry for a signed-in user", () => {
    const el = render(<AuthActions user={{ name: "An", email: null, avatarUrl: null }} {...props} />);
    expect(el.querySelector("a")?.getAttribute("href")).toBe("/learn");
    expect(el.textContent).toBe("AVào học");
  });

  it("reserves space while the session is unknown", () => {
    const el = render(<AuthActions user={undefined} {...props} />);
    expect(el.querySelector("[data-pending]")).not.toBeNull();
  });
});

describe("readSiteSession", () => {
  function storage(entries: Record<string, string>) {
    const keys = Object.keys(entries);
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => entries[k] ?? null };
  }

  it("reads the Supabase session written by the app", () => {
    const session = JSON.stringify({ refresh_token: "r", user: { email: "a@b.c", user_metadata: { full_name: "An Nguyen", avatar_url: "https://x/a.png" } } });
    expect(readSiteSession(storage({ theme: "dark", "sb-abcdef-auth-token": session }))).toEqual({
      name: "An Nguyen", email: "a@b.c", avatarUrl: "https://x/a.png",
    });
  });

  it("treats missing, signed-out and malformed entries as guests", () => {
    expect(readSiteSession(storage({}))).toBeNull();
    expect(readSiteSession(storage({ "sb-abc-auth-token": JSON.stringify({ user: {} }) }))).toBeNull();
    expect(readSiteSession(storage({ "sb-abc-auth-token": "{" }))).toBeNull();
    expect(readSiteSession(null)).toBeNull();
  });
});
