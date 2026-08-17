import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SkillTag } from "@/components/skills/SkillTag";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfileCourseSkills } from "@/lib/courses";

export function UserProfileSkillsCard({ profileId }: { profileId: string }) {
  const { t } = useTranslation("common");
  const [loadedResult, setLoadedResult] = useState<{
    profileId: string;
    skills: string[];
  }>({ profileId: "", skills: [] });

  useEffect(() => {
    let cancelled = false;

    void getProfileCourseSkills(profileId)
      .then((items) => {
        if (!cancelled) setLoadedResult({ profileId, skills: items });
      })
      .catch(() => {
        if (!cancelled) setLoadedResult({ profileId, skills: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const loading = loadedResult.profileId !== profileId;
  const skills = loading ? [] : loadedResult.skills;

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-base p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-foreground-muted" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">
          {t("userProfile.skills.title")}
        </h2>
      </div>

      {loading ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-36 rounded-full" />
        </div>
      ) : skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {skills.map((skill) => (
            <SkillTag key={skill}>
              {skill}
            </SkillTag>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-foreground-muted">
          {t("userProfile.skills.empty")}
        </p>
      )}
    </section>
  );
}
