import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LogOut, Search } from "lucide-react";

import type { SiteHeaderLinkProps } from "./SiteHeader";
import type { SiteNavLink } from "./nav";
import type { SiteSessionUser } from "./session";

const defaultLink = ({ children, ...props }: SiteHeaderLinkProps) => <a {...props}>{children}</a>;

function initial(user: SiteSessionUser): string {
  return (user.name ?? user.email ?? "U").charAt(0).toUpperCase();
}

export type AccountMenuProps = {
  user: SiteSessionUser;
  /** Shared destinations (`siteAccountLinks`) plus any the host adds, e.g. role-based workspaces. */
  items: SiteNavLink[];
  /** "Log out": a link on the landing site (the app owns the session), an action inside the app. */
  signOut: { label: string; href?: string; onSelect?: () => void };
  label: string;
  /** Extra content under the name, e.g. the app's XP badges. */
  summary?: ReactNode;
  renderLink?: (props: SiteHeaderLinkProps) => ReactNode;
};

/** Avatar button with the signed-in user's menu; identical on the landing site and in the app. */
export function AccountMenu({ user, items, signOut, label, summary, renderLink = defaultLink }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);
  const name = user.name ?? user.email ?? "";

  return (
    <div ref={rootRef} className="csh-account">
      <button
        type="button"
        className="csh-account-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {user.avatarUrl
          ? <img className="csh-avatar csh-avatar-lg" src={user.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" />
          : <span className="csh-avatar csh-avatar-lg" aria-hidden>{initial(user)}</span>}
        {name ? <span className="csh-account-name">{name}</span> : null}
      </button>
      <div id={panelId} className="csh-account-panel" hidden={!open}>
        <div className="csh-account-head">
          <span className="csh-account-title">{name}</span>
          {user.email && user.email !== name ? <span className="csh-menu-desc">{user.email}</span> : null}
          {summary}
        </div>
        <ul className="csh-account-list">
          {items.map((item) => (
            <li key={item.href}>
              {renderLink({ href: item.href, className: "csh-account-link", onClick: close, children: item.label })}
            </li>
          ))}
        </ul>
        <div className="csh-account-sep" />
        {signOut.href
          ? renderLink({
            href: signOut.href,
            className: "csh-account-link csh-account-signout",
            onClick: close,
            children: <><LogOut aria-hidden size={16} />{signOut.label}</>,
          })
          : (
            <button
              type="button"
              className="csh-account-link csh-account-signout"
              onClick={() => { close(); signOut.onSelect?.(); }}
            >
              <LogOut aria-hidden size={16} />
              {signOut.label}
            </button>
          )}
      </div>
    </div>
  );
}

export type SearchLinkProps = {
  href: string;
  label: string;
  renderLink?: (props: SiteHeaderLinkProps) => ReactNode;
};

/** Search icon in the header; both sites open the app's search page. */
export function SearchLink({ href, label, renderLink = defaultLink }: SearchLinkProps) {
  return renderLink({
    href,
    className: "csh-icon-button",
    children: <><Search aria-hidden size={20} /><span className="csh-sr-only">{label}</span></>,
  });
}
