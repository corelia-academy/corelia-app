import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

const links = [
  ["/jobs", "nav.find"],
  ["/jobs/saved", "nav.saved"],
  ["/jobs/applied", "nav.applied"],
  ["/jobs/market", "nav.market"],
] as const;

export function JobsNav() {
  const { t } = useTranslation("jobs");
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg border border-border-subtle bg-surface-base p-1" aria-label={t("nav.label")}>
      {links.map(([href, key]) => (
        <NavLink
          key={href}
          to={href}
          end={href === "/jobs"}
          className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"}`}
        >
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}
