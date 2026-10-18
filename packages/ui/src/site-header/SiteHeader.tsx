import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

import type { SiteNavGroup, SiteNavLink } from "./nav";

export type SiteHeaderLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
  onClick?: () => void;
  "aria-current"?: "page";
};

export type SiteHeaderProps = {
  logo: { href: string; src: string; alt: string };
  nav: SiteNavGroup[];
  /** Current landing path, used to mark the active group and link. */
  activePath?: string;
  /** Renders links; defaults to a plain anchor (the landing site). The app passes its router link. */
  renderLink?: (props: SiteHeaderLinkProps) => ReactNode;
  /** Before the logo, e.g. the app's sidebar trigger. */
  start?: ReactNode;
  /** Between navigation and actions, e.g. the app's search field. */
  center?: ReactNode;
  /** Right-hand actions: language, auth buttons or the account menu. */
  end?: ReactNode;
  /** Extra content at the bottom of the mobile drawer (auth buttons). Hidden when `mobileMenu` is false. */
  mobileFooter?: ReactNode;
  /** Show the hamburger drawer below the desktop breakpoint (the app uses its own sidebar instead). */
  mobileMenu?: boolean;
  /** "sticky" inside the app layout; "fixed" on the landing site, whose pages offset by --site-header-height. */
  position?: "sticky" | "fixed";
  labels: { mainNav: string; menu: string; closeMenu: string };
};

const defaultLink = ({ children, ...props }: SiteHeaderLinkProps) => <a {...props}>{children}</a>;

function isActive(href: string, activePath?: string): boolean {
  if (!activePath) return false;
  const path = activePath.replace(/\/+$/, "") || "/";
  const target = href.replace(/\/+$/, "") || "/";
  return path === target || (target !== "/" && path.startsWith(`${target}/`));
}

function groupActive(group: SiteNavGroup, activePath?: string): boolean {
  return Boolean(group.href && isActive(group.href, activePath))
    || Boolean(group.items?.some((item) => isActive(item.href, activePath)));
}

/**
 * Header shared by the landing site and the learning app (Binance-style: logo, mega-menu
 * navigation, actions on the right). Styling lives in site-header.css so it renders the same
 * under both apps' Tailwind themes.
 */
export function SiteHeader({
  logo, nav, activePath, renderLink = defaultLink, start, center, end, mobileFooter,
  mobileMenu = true, position = "sticky", labels,
}: SiteHeaderProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const drawerId = useId();

  useEffect(() => {
    if (!openGroup) return;
    const onPointerDown = (event: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpenGroup(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [openGroup]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);

  const openSoon = (id: string) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpenGroup(id);
  };
  const closeSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenGroup(null), 120);
  };

  const link = (item: SiteNavLink, className: string, onClick?: () => void, withDescription = true) => renderLink({
    href: item.href,
    className,
    onClick,
    "aria-current": isActive(item.href, activePath) ? "page" : undefined,
    children: (
      <>
        <span className="csh-menu-label">{item.label}</span>
        {withDescription && item.description ? <span className="csh-menu-desc">{item.description}</span> : null}
      </>
    ),
  });

  return (
    <header className="csh" data-position={position} data-site-header>
      <div className="csh-bar">
        <div className="csh-left">
          {start}
          {renderLink({
            href: logo.href,
            className: "csh-logo",
            children: <img src={logo.src} alt={logo.alt} width={120} height={32} />,
          })}
          <nav ref={navRef} className="csh-nav" aria-label={labels.mainNav}>
            <ul className="csh-nav-list">
              {nav.map((group) => {
                const active = groupActive(group, activePath);
                if (!group.items?.length) {
                  return (
                    <li key={group.id}>
                      {renderLink({
                        href: group.href ?? "/",
                        className: "csh-nav-trigger",
                        "aria-current": active ? "page" : undefined,
                        children: group.label,
                      })}
                    </li>
                  );
                }
                const open = openGroup === group.id;
                const panelId = `${drawerId}-${group.id}`;
                return (
                  <li
                    key={group.id}
                    className="csh-nav-item"
                    onPointerEnter={(event) => { if (event.pointerType === "mouse") openSoon(group.id); }}
                    onPointerLeave={(event) => { if (event.pointerType === "mouse") closeSoon(); }}
                    onKeyDown={(event) => { if (event.key === "Escape") setOpenGroup(null); }}
                  >
                    <button
                      type="button"
                      className="csh-nav-trigger"
                      data-active={active || undefined}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenGroup(open ? null : group.id)}
                    >
                      {group.label}
                      <ChevronDown className="csh-chevron" aria-hidden size={14} />
                    </button>
                    <div id={panelId} className="csh-panel" hidden={!open}>
                      <ul className="csh-panel-list">
                        {group.items.map((item) => (
                          <li key={item.href}>{link(item, "csh-menu-link", () => setOpenGroup(null))}</li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        {center ? <div className="csh-center">{center}</div> : null}
        <div className="csh-end">
          {end}
          {mobileMenu ? (
            <button
              type="button"
              className="csh-icon-button csh-menu-button"
              aria-label={labels.menu}
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu aria-hidden size={22} />
            </button>
          ) : null}
        </div>
      </div>

      {mobileMenu ? (
        <div id={drawerId} className="csh-drawer" hidden={!drawerOpen} role="dialog" aria-modal="true" aria-label={labels.mainNav}>
          <div className="csh-drawer-head">
            {renderLink({
              href: logo.href,
              className: "csh-logo",
              onClick: () => setDrawerOpen(false),
              children: <img src={logo.src} alt={logo.alt} width={120} height={32} />,
            })}
            <button type="button" className="csh-icon-button" aria-label={labels.closeMenu} onClick={() => setDrawerOpen(false)}>
              <X aria-hidden size={22} />
            </button>
          </div>
          <ul className="csh-drawer-list">
            {nav.map((group) => {
              if (!group.items?.length) {
                return (
                  <li key={group.id}>
                    {renderLink({
                      href: group.href ?? "/",
                      className: "csh-drawer-trigger",
                      onClick: () => setDrawerOpen(false),
                      children: group.label,
                    })}
                  </li>
                );
              }
              const isExpanded = expanded === group.id;
              const sectionId = `${drawerId}-m-${group.id}`;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    className="csh-drawer-trigger"
                    aria-expanded={isExpanded}
                    aria-controls={sectionId}
                    onClick={() => setExpanded(isExpanded ? null : group.id)}
                  >
                    {group.label}
                    <ChevronDown className="csh-chevron" aria-hidden size={16} />
                  </button>
                  <ul id={sectionId} className="csh-drawer-sub" hidden={!isExpanded}>
                    {group.items.map((item) => (
                      <li key={item.href}>{link(item, "csh-drawer-link", () => setDrawerOpen(false), false)}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {mobileFooter ? <div className="csh-drawer-foot">{mobileFooter}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
