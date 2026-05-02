import { cn } from "@/lib/utils";
import type { Contest } from "@/types/contests";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const NAV_KEYS = [
  "overview",
  "timeline",
  "prizes",
  "rules",
  "faqs",
  "projects",
  "apply",
] as const;

export function ContestPublicNav({
  contestId,
  contest,
}: {
  contestId: string;
  contest: Contest;
}) {
  const { t } = useTranslation("contests");
  const showProjects =
    contest.status === "ended" && contest.published_leaderboard.length > 0;

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto pb-1 pt-2"
      aria-label={t("detail.public.nav.ariaLabel")}
    >
      {NAV_KEYS.filter((key) => (key === "projects" ? showProjects : true)).map((key) => (
        <NavLink
          key={key}
          to={`/contests/${contestId}/${key}`}
          className={({ isActive }) =>
            cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          {t(`detail.public.nav.${key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
