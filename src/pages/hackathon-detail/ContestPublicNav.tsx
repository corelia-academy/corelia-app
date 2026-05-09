import { cn } from "@/lib/utils";
import type { Contest } from "@/types/hackathons";
import { contestPublicShowcaseProjectsNavVisible } from "@/pages/hackathon-detail/utils/contestShowcase";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const NAV_KEYS = [
  "overview",
  "timeline",
  "prizes",
  "rules",
  "faqs",
  "projects",
] as const;

export function ContestPublicNav({
  contest,
}: {
  contest: Contest;
}) {
  const { t } = useTranslation("contests");
  const showProjects = contestPublicShowcaseProjectsNavVisible(contest);
  const contestSlug = contest.slug?.trim() || "";

  return (
    <nav
      className="-mx-1 mb-6 border-b border-border-subtle sm:mb-8"
      aria-label={t("detail.public.nav.ariaLabel")}
    >
      <div
        className="-mb-px flex gap-0 overflow-x-auto overscroll-x-contain px-1 pb-px sm:gap-1"
      >
        {NAV_KEYS.filter((key) => (key === "projects" ? showProjects : true)).map((key) => (
          <NavLink
            key={key}
            to={contestSlug ? `/hackathons/${contestSlug}/${key}` : "/hackathons"}
            className={({ isActive }) =>
              cn(
                "inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
              )
            }
          >
            {t(`detail.public.nav.${key}`)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
