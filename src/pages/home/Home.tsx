import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";
import { Award, PlaySquare, Trophy } from "lucide-react";
import { intlLocale } from "@/lib/intl";

import { useHomeCatalogAndContests } from "./hooks/useHomeCatalogAndContests";
import { useHomeUserDashboard } from "./hooks/useHomeUserDashboard";
import type { PinnedProgramCard } from "./utils/homeTypes";
import { formatCourseMeta, pickCourseFormat } from "./utils/homeFormat";

import { GuestHome } from "./components/GuestHome";
import { HomeHeader } from "./components/HomeHeader";
import { MomentumCards } from "./components/MomentumCards";
import { ContinueLearningSection } from "./components/ContinueLearningSection";
import { ExploreCoursesSection } from "./components/ExploreCoursesSection";

export default function Home() {
  const { t } = useTranslation("common");
  const { profile, user, isAuthenticated } = useAuth();

  const { courseCatalog, contests } = useHomeCatalogAndContests();
  const {
    loading,
    focusCards,
    issuedCertificates,
    dashboardConfig,
  } = useHomeUserDashboard(user, t);

  const oauthDisplayName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : undefined;
  const displayName =
    profile?.full_name?.trim() || oauthDisplayName || t("home.studentFallback");
  const firstName = displayName.split(" ")[0] || displayName;
  const momentumCards = useMemo(
    () => [
      {
        label: t("home.momentum.learning.label"),
        value: String(focusCards.length),
        note:
          focusCards.length > 0
            ? `${focusCards.filter((item) => item.format === "online").length} online · ${
                focusCards.filter((item) => item.format === "offline").length
              } offline`
            : t("home.momentum.learning.emptyNote"),
        icon: PlaySquare,
      },
      {
        label: t("home.momentum.contests.label"),
        value: String(contests.length),
        note:
          contests.length > 0
            ? t("home.momentum.contests.note")
            : t("home.momentum.contests.emptyNote"),
        icon: Trophy,
      },
      {
        label: t("home.momentum.certificates.label"),
        value: String(issuedCertificates),
        note:
          issuedCertificates > 0
            ? t("home.momentum.certificates.note")
            : t("home.momentum.certificates.emptyNote"),
        icon: Award,
      },
    ],
    [contests.length, focusCards, issuedCertificates, t],
  );

  const featuredFocus = focusCards[0] ?? null;

  const pinnedPrograms = useMemo<PinnedProgramCard[]>(() => {
    if (!dashboardConfig) return [];

    return dashboardConfig.pinned_programs
      .filter((item) => item.active)
      .map((item) => {
        if (item.type === "course") {
          const enrolledCourse = focusCards.find((entry) => entry.id === item.ref_id);
          const catalogCourse = courseCatalog.find((entry) => entry.id === item.ref_id);
          if (enrolledCourse) {
            return {
              id: item.id,
              badge: item.badge || t("home.pinned.badges.onlinePath"),
              title: item.title_override || enrolledCourse.title,
              description:
                item.description_override ||
                t("home.pinned.courseFallbackDescription", { nextStep: enrolledCourse.nextStep }),
              to: `/courses/${enrolledCourse.id}`,
              cta: item.cta_label || t("home.pinned.cta.viewCourse"),
              meta: enrolledCourse.meta,
            };
          }
          if (catalogCourse) {
            return {
              id: item.id,
              badge: item.badge || t("home.pinned.badges.onlinePath"),
              title: item.title_override || catalogCourse.title,
              description:
                item.description_override ||
                catalogCourse.short_description ||
                catalogCourse.description,
              to: `/courses/${catalogCourse.id}`,
              cta: item.cta_label || t("home.pinned.cta.viewCourse"),
              meta: formatCourseMeta(catalogCourse, pickCourseFormat(catalogCourse)),
            };
          }
          return null;
        }

        if (item.type === "contest") {
          const contest = contests.find((entry) => entry.id === item.ref_id);
          if (!contest) return null;
          return {
            id: item.id,
            badge: item.badge || t("home.pinned.badges.ecosystemPlayground"),
            title: item.title_override || contest.title,
            description: item.description_override || contest.tagline,
            to: contest.slug ? `/hackathons/${contest.slug}` : "/hackathons",
            cta: item.cta_label || t("home.pinned.cta.viewContest"),
            meta:
              contest.registration_deadline != null
                ? t("home.pinned.contest.registrationDeadline", {
                    date: new Date(contest.registration_deadline).toLocaleDateString(intlLocale()),
                  })
                : t("home.pinned.contest.openInEcosystem"),
          };
        }

        return null;
      })
      .filter((item): item is PinnedProgramCard => item != null)
      .slice(0, 1);
  }, [contests, courseCatalog, dashboardConfig, focusCards, t]);

  const activePinnedProgram = pinnedPrograms[0] ?? null;

  // Header already surfaces either the pinned program or the first focus card,
  // so drop the first focus card from the strip below when no pinned program
  // is shown to avoid showing the same course twice.
  const continueLearningCards = activePinnedProgram
    ? focusCards
    : focusCards.slice(1);

  if (!isAuthenticated) {
    return <GuestHome t={t} courseCatalog={courseCatalog} contests={contests} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="min-w-0 space-y-6">
        <HomeHeader
          t={t}
          loading={loading}
          firstName={firstName}
          activePinnedProgram={activePinnedProgram}
          featuredFocus={featuredFocus}
        />

        <MomentumCards items={momentumCards} />

        {continueLearningCards.length > 0 ? (
          <ContinueLearningSection t={t} focusCards={continueLearningCards} />
        ) : null}

        <ExploreCoursesSection t={t} courseCatalog={courseCatalog} />
      </div>
    </div>
  );
}
