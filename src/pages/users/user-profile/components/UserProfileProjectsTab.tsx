import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import { publicProfileProjectsQueryOptions } from "@/features/profiles/publicProfileQueries";
import { publicProjectTeamsQueryOptions } from "@/features/projects/projectQueries";
import { projectSavesQueryOptions } from "@/features/projects/projectSaveQueries";
import { projectHeartsQueryOptions } from "@/features/projects/projectSocialQueries";
import { listProjectTaxonomyOptions } from "@/lib/projectTaxonomy";
import { useAuth } from "@/stores/authStore";
import type { PublicProfile } from "@/types/database";

import { UserProfileSectionHeader } from "./UserProfileSectionHeader";

const VISIBLE_PROJECTS = 4;

export function UserProfileProjectsTab({ profile, isSelf }: { profile: PublicProfile; isSelf: boolean }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [expanded, setExpanded] = useState(false);
  const projectsQuery = useQuery(publicProfileProjectsQueryOptions(profile.id, i18n.language));
  const items = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const projectIds = useMemo(() => items.map((project) => project.id), [items]);
  const heartsQuery = useQuery(projectHeartsQueryOptions(user?.id, projectIds));
  const savesQuery = useQuery(projectSavesQueryOptions(user?.id, projectIds));
  const teamsQuery = useQuery(publicProjectTeamsQueryOptions(projectIds));
  const hackathonsQuery = useQuery(publicHackathonCatalogQueryOptions(locale));
  const taxonomyQuery = useQuery({
    queryKey: ["projects", "taxonomy", locale],
    queryFn: () => listProjectTaxonomyOptions(locale),
    staleTime: 5 * 60_000,
  });
  const hackathons = hackathonsQuery.data ?? [];
  const systemTaxonomy = taxonomyQuery.data ?? [];
  const visible = expanded ? items : items.slice(0, VISIBLE_PROJECTS);
  const title = isSelf ? t("userProfile.projects.mine") : t("projects.title");

  const viewAll =
    items.length > VISIBLE_PROJECTS && !expanded ? (
      <Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => setExpanded(true)}>
        {t("userProfile.xpHistory.viewAll")}
      </Button>
    ) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label={title} className="flex flex-col gap-4">
        <UserProfileSectionHeader title={title} action={viewAll} />
        {projectsQuery.isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-60 w-full rounded-md" />
            <Skeleton className="h-60 w-full rounded-md" />
          </div>
        ) : projectsQuery.isError ? (
          <p className="text-sm text-foreground-muted">{t("userProfile.errors.loadFailed")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-foreground-muted">{t("userProfile.projects.empty")}</p>
        ) : (
          <>
          <div className="flex flex-col gap-4">
            {visible.map((project) => {
              const ownedByProfile = project.owner_id === profile.id;
              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  systemTaxonomy={systemTaxonomy}
                  taxonomy={hackathons.find((item) => item.id === project.source_id)}
                  hearted={heartsQuery.data?.has(project.id) ?? false}
                  saved={savesQuery.data?.has(project.id) ?? false}
                  saveStateReady={savesQuery.isSuccess && !savesQuery.isPlaceholderData}
                  ownerLabel={ownedByProfile ? profile.full_name ?? profile.username : undefined}
                  ownerHandle={ownedByProfile ? profile.username ?? profile.ocid : undefined}
                  ownerAvatarUrl={ownedByProfile ? profile.avatar_url : undefined}
                  ownerAvatarSeed={ownedByProfile ? profile.avatar_seed : undefined}
                  ownerAvatarConfig={ownedByProfile ? profile.avatar_config : undefined}
                  teamMembers={teamsQuery.data?.[project.id] ?? []}
                />
              );
            })}
          </div>
          {expanded && items.length > VISIBLE_PROJECTS ? (
            <div className="flex">
              <Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => setExpanded(false)}>
                {t("userProfile.xpHistory.collapse")}
              </Button>
            </div>
          ) : null}
          </>
        )}
      </section>

      {/* TODO(figma-projects-saved): khối "Dự án đã lưu" cần hàm liệt kê project_saves của chính chủ (phương án 4b) */}
    </div>
  );
}
