import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";

import { useHomeCatalogAndContests } from "./hooks/useHomeCatalogAndContests";
import { useHomeUserDashboard } from "./hooks/useHomeUserDashboard";

import { GuestHome } from "./components/GuestHome";
import { HomeHeader } from "./components/HomeHeader";
import { ContinueLearningSection } from "./components/ContinueLearningSection";
import { ExploreCoursesSection } from "./components/ExploreCoursesSection";
import { HomeXpPanel } from "./components/HomeXpPanel";
import { HomeXpMissionsPanel } from "./components/HomeXpMissionsPanel";

export default function Home() {
  const { t } = useTranslation("common");
  const { profile, user, isAuthenticated } = useAuth();

  const { courseCatalog, courseLessonCounts } = useHomeCatalogAndContests();
  const { loading, focusCards, enrolledCourseCount } = useHomeUserDashboard(user, t);

  const oauthDisplayName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : undefined;
  const displayName =
    profile?.full_name?.trim() || oauthDisplayName || t("home.studentFallback");
  const firstName = displayName.split(" ")[0] || displayName;
  if (!isAuthenticated) {
    return <GuestHome t={t} courseCatalog={courseCatalog} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 pb-6 pt-0 sm:px-6 sm:py-8 lg:px-8xl lg:py-7xl @container">
      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(0,1fr)_280px] @max-[807px]:grid-cols-1!">
        <div className="min-w-0 md:col-start-1 md:row-start-1 @max-[807px]:col-auto!">
          <HomeHeader
            t={t}
            loading={loading}
            firstName={firstName}
          />
        </div>

        <aside
          className="min-w-0 space-y-4 md:col-start-2 md:row-start-1 md:row-span-2 md:self-start @max-[807px]:col-auto! @max-[807px]:row-start-auto! @max-[807px]:row-span-1! @min-[504px]:@max-[807px]:grid @min-[504px]:@max-[807px]:grid-cols-2! @min-[504px]:@max-[807px]:items-start! @min-[504px]:@max-[807px]:gap-4! @min-[504px]:@max-[807px]:space-y-0!"
          aria-label={t("home.xpMissions.sidebarLabel")}
        >
          <HomeXpPanel userId={user?.id} />
          <HomeXpMissionsPanel userId={user?.id} />
        </aside>

        <main className="min-w-0 space-y-6 md:col-start-1 md:row-start-2 @max-[807px]:col-auto! @max-[807px]:row-start-auto!">
          {!loading ? (
            <ContinueLearningSection
              t={t}
              focusCards={focusCards}
              enrolledCourseCount={enrolledCourseCount}
            />
          ) : null}

          <ExploreCoursesSection
            t={t}
            courseCatalog={courseCatalog}
            courseLessonCounts={courseLessonCounts}
          />
        </main>
      </div>
    </div>
  );
}
