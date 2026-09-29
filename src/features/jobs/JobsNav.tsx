import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";

const links = [
  ["/jobs", "nav.find"],
  ["/jobs/saved", "nav.saved"],
  ["/jobs/applied", "nav.applied"],
  ["/jobs/hidden", "nav.hidden"],
  ["/jobs/market", "nav.market"],
] as const;

export function JobsNav() {
  const { t } = useTranslation("jobs");
  return (
    <div className="relative rounded-lg border border-border-subtle bg-surface-base">
      <nav className="flex gap-1 overflow-x-auto overscroll-x-contain p-1 pr-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t("nav.label")}>
        {links.map(([href, key]) => (
          <NavLink
            key={href}
            to={href}
            end={href === "/jobs"}
            className={({ isActive }) => `inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"}`}
          >
            {t(key)}
          </NavLink>
        ))}
      </nav>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-7 rounded-r-lg bg-linear-to-l from-surface-base to-transparent" />
    </div>
  );
}
