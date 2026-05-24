import { useTranslation } from "react-i18next";

import { getRoleLabel, type PublicProfile } from "@/types/database";

export function UserProfileOverviewSection({
  profile,
}: {
  profile: PublicProfile;
}) {
  const { t } = useTranslation("common");

  const headline =
    profile.instructor_headline?.trim() ||
    (profile.role === "instructor"
      ? t("userProfile.overview.instructorHeadlineFallback")
      : "");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("userProfile.overview.title")}
        </h2>
        {headline ? (
          <p className="mt-2 text-sm leading-6 text-foreground-muted">{headline}</p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-foreground-muted">
            {t("userProfile.overview.empty")}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface-base shadow-card p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("userProfile.overview.quickInfo")}
        </h2>
        <div className="mt-3 space-y-2 text-sm text-foreground-muted">
          <div className="flex items-center justify-between gap-3">
            <span>{t("userProfile.labels.role")}</span>
            <span className="font-medium text-foreground">
              {getRoleLabel(profile.role)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>{t("userProfile.labels.memberSince")}</span>
            <span className="font-medium text-foreground">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
