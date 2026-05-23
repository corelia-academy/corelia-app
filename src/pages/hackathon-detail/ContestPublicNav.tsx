import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { Contest } from "@/types/hackathons";
import { contestPublicShowcaseProjectsNavVisible } from "@/pages/hackathon-detail/utils/contestShowcase";
import type { HackathonLifecycle } from "@/pages/hackathon-detail/utils/contestLifecycle";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";
import { Link, useLocation } from "react-router";

type NavItem = { key: string; id: string; hash: string };

function buildNavItems(contest: Contest, lifecycle: HackathonLifecycle | null): NavItem[] {
  const showProjects = contestPublicShowcaseProjectsNavVisible(contest);
  const items: NavItem[] = [];
  if (contest.description?.trim()) {
    items.push({ key: "overview", id: "about", hash: "#about" });
  }
  items.push({ key: "timeline", id: "timeline", hash: "#timeline" });
  if ((contest.resources?.length ?? 0) > 0) {
    items.push({ key: "resources", id: "resources", hash: "#resources" });
  }
  const track =
    contest.tracks?.find((tr) => tr.active !== false) ?? contest.tracks?.[0];
  if (track?.name?.trim()) {
    items.push({ key: "track", id: "track", hash: "#track" });
  }
  const showPrizesSection =
    (contest.prizes?.length ?? 0) > 0 || Boolean(contest.prize_pool_summary?.trim());
  if (showPrizesSection) {
    items.push({ key: "prizes", id: "prizes", hash: "#prizes" });
  }
  if ((contest.badges?.length ?? 0) > 0) {
    items.push({ key: "badges", id: "badges", hash: "#badges" });
  }
  const official =
    contest.official_course_id?.trim() ||
    contest.officialCourseId?.trim() ||
    "";
  const relCourses =
    contest.related_course_ids?.length ?? contest.relatedCourseIds?.length ?? 0;
  const relTracks =
    contest.related_career_track_ids?.length ??
    contest.relatedCareerTrackIds?.length ??
    0;
  if (official.length > 0 || relCourses > 0 || relTracks > 0) {
    items.push({ key: "learn", id: "learn", hash: "#learn" });
  }
  const mentors = contest.mentor_emails?.length ?? 0;
  const judges = contest.judge_emails?.length ?? 0;
  if (mentors > 0 || judges > 0) {
    items.push({ key: "people", id: "people", hash: "#people" });
  }
  if ((contest.organizational_partners?.length ?? 0) > 0) {
    items.push({ key: "partners", id: "partners", hash: "#partners" });
  }
  if (contest.rules?.trim()) {
    items.push({ key: "rules", id: "rules", hash: "#rules" });
  }
  if ((contest.faqs?.length ?? 0) > 0) {
    items.push({ key: "faqs", id: "faq", hash: "#faq" });
  }
  const resultsVisible =
    lifecycle === "ended" &&
    (contest.published_leaderboard.length > 0 ||
      contest.winner_announcements.length > 0);
  if (resultsVisible) {
    items.push({ key: "results", id: "results", hash: "#results" });
  }
  if (showProjects) {
    items.push({ key: "projects", id: "projects", hash: "#projects" });
  }
  items.push({ key: "finalCta", id: "final-cta", hash: "#final-cta" });
  return items;
}

export function ContestPublicNav() {
  const vm = useContestDetailVm();
  const { contest, translate, hackathonLifecycle } = vm;
  const location = useLocation();
  const contestSlug = contest.slug?.trim() || "";
  const base = contestSlug ? `/hackathons/${contestSlug}` : "/hackathons";

  const navItems = useMemo(() => buildNavItems(contest, hackathonLifecycle), [contest, hackathonLifecycle]);

  /** Ignore intersection-driven highlights briefly after hash navigation (avoids tab flicker while smooth-scroll runs). */
  const ignoreIntersectionUntilRef = useRef(0);

  const [activeId, setActiveId] = useState(() => {
    return navItems[0]?.id ?? "";
  });

  const hashActiveId = useMemo(() => {
    const raw = location.hash.replace(/^#/, "").trim();
    if (!raw) return null;
    const id = decodeURIComponent(raw);
    return navItems.some((item) => item.id === id) ? id : null;
  }, [location.hash, navItems]);

  const displayedActiveId = hashActiveId ?? (
    navItems.some((item) => item.id === activeId) ? activeId : (navItems[0]?.id ?? "")
  );

  useEffect(() => {
    const raw = location.hash.replace(/^#/, "").trim();
    if (!raw) return;
    const id = decodeURIComponent(raw);
    if (navItems.some((i) => i.id === id)) {
      ignoreIntersectionUntilRef.current = Date.now() + 650;
    }
  }, [location.hash, navItems]);

  useEffect(() => {
    if (navItems.length === 0) return;
    const elements = navItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < ignoreIntersectionUntilRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.15)
          .sort(
            (a, b) =>
              a.target.getBoundingClientRect().top -
              b.target.getBoundingClientRect().top,
          );
        const first = visible[0]?.target.id;
        if (first) setActiveId(first);
      },
      {
        root: null,
        rootMargin: "-12% 0px -55% 0px",
        threshold: [0.1, 0.2, 0.35],
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [navItems]);

  return (
    <div
      className={cn(
        "sticky top-14 z-30 -mx-1 mb-6 border-b border-border-subtle bg-background/90 backdrop-blur-md sm:mb-8",
        "supports-[backdrop-filter]:bg-background/80",
      )}
    >
      <div className="py-2">
        <nav
          className="min-w-0 px-1"
          aria-label={translate("detail.public.nav.ariaLabel")}
        >
          <div className="-mb-px flex gap-4 overflow-x-auto overscroll-x-contain pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
            {navItems.map((item) => {
              const active = displayedActiveId === item.id;
              const to = `${base}${item.hash}`;
              return (
                <Link
                  key={item.key}
                  to={to}
                  className={cn(
                    "snap-start inline-flex min-h-11 shrink-0 items-center border-b-2 px-2 pb-2 pt-2 text-sm font-medium transition-colors duration-150",
                    "rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-foreground-muted hover:border-border hover:text-foreground",
                  )}
                >
                  {translate(`detail.public.nav.${item.key}`)}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
