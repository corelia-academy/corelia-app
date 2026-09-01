import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/stores/authStore";
import { Award, PlaySquare } from "lucide-react";

import { useHomeCatalogAndContests } from "./hooks/useHomeCatalogAndContests";
import { useHomeUserDashboard } from "./hooks/useHomeUserDashboard";

import { GuestHome } from "./components/GuestHome";
import { HomeHeader } from "./components/HomeHeader";
import { MomentumCards } from "./components/MomentumCards";
import { ContinueLearningSection } from "./components/ContinueLearningSection";
import { ExploreCoursesSection } from "./components/ExploreCoursesSection";

export default function Home() {
  const { t } = useTranslation("common");
  const { profile, user, isAuthenticated } = useAuth();

  const { courseCatalog } = useHomeCatalogAndContests();
  const { loading, focusCards, issuedCertificates } = useHomeUserDashboard(user, t);

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
        label: t("home.momentum.certificates.label"),
        value: String(issuedCertificates),
        note:
          issuedCertificates > 0
            ? t("home.momentum.certificates.note")
            : t("home.momentum.certificates.emptyNote"),
        icon: Award,
      },
    ],
    [focusCards, issuedCertificates, t],
  );

  const featuredFocus = focusCards[0] ?? null;

  // The header surfaces the most recently accessed course, so avoid rendering
  // the same course again in the continuation strip.
  const continueLearningCards = focusCards.slice(1);

  if (!isAuthenticated) {
    return <GuestHome t={t} courseCatalog={courseCatalog} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="min-w-0 space-y-6">
        <HomeHeader
          t={t}
          loading={loading}
          firstName={firstName}
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
