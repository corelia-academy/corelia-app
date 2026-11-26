import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { publicHackathonCatalogQueryOptions } from "@/features/hackathons/hackathonQueries";
import { publicProfileProjectsQueryOptions } from "@/features/profiles/publicProfileQueries";
import { publicProjectEntriesByIdsQueryOptions, publicProjectTeamsQueryOptions } from "@/features/projects/projectQueries";
import { mySavedProjectIdsQueryOptions, projectSavesQueryOptions } from "@/features/projects/projectSaveQueries";
import { projectHeartsQueryOptions } from "@/features/projects/projectSocialQueries";
import { listProjectTaxonomyOptions } from "@/lib/projectTaxonomy";
import { useAuth } from "@/stores/authStore";
import type { PublicProfile } from "@/types/database";

import { UserProfileSectionHeader } from "./UserProfileSectionHeader";

const VISIBLE_PROJECTS = 4;

export function UserProfileProjectsSection({ profile, isSelf = false }: { profile: PublicProfile; isSelf?: boolean }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("common");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [expanded, setExpanded] = useState(false);
  const [savedExpanded, setSavedExpanded] = useState(false);

  const projectsQuery = useQuery(publicProfileProjectsQueryOptions(profile.id, i18n.language));
  const items = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  // Dự án đã lưu là riêng tư: chỉ chủ hồ sơ mới thấy
  const savedIdsQuery = useQuery(mySavedProjectIdsQueryOptions(user?.id, isSelf));
  const savedIds = useMemo(() => savedIdsQuery.data ?? [], [savedIdsQuery.data]);
  const savedEntriesQuery = useQuery(publicProjectEntriesByIdsQueryOptions(isSelf ? savedIds : [], locale));
  const savedItems = useMemo(() => (isSelf ? savedEntriesQuery.data ?? [] : []), [isSelf, savedEntriesQuery.data]);
  const savedLoading = savedIdsQuery.isPending || (savedIds.length > 0 && savedEntriesQuery.isPending);

  const projectIds = useMemo(() => [...items.map((project) => project.id), ...savedItems.map(({ project }) => project.id)], [items, savedItems]);
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
  const savedVisible = savedExpanded ? savedItems : savedItems.slice(0, VISIBLE_PROJECTS);
  const title = isSelf ? t("userProfile.projects.mine") : t("projects.title");

  const toggle = (shown: boolean, count: number, setShown: (value: boolean) => void) =>
    count > VISIBLE_PROJECTS && !shown ? (
      <Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => setShown(true)}>
        {t("userProfile.xpHistory.viewAll")}
      </Button>
    ) : undefined;
  const collapse = (shown: boolean, count: number, setShown: (value: boolean) => void) =>
    shown && count > VISIBLE_PROJECTS ? (
      <div className="flex">
        <Button type="button" variant="cta" hierarchy="tertiary" size="small" onClick={() => setShown(false)}>
          {t("userProfile.xpHistory.collapse")}
        </Button>
      </div>
    ) : null;

  const cardProps = {
    systemTaxonomy,
    saveStateReady: savesQuery.isSuccess && !savesQuery.isPlaceholderData,
  };

  return (
    <div className="flex flex-col gap-12">
      <section aria-label={title} className="flex flex-col gap-4">
        <UserProfileSectionHeader title={title} action={toggle(expanded, items.length, setExpanded)} />
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
                    {...cardProps}
                    taxonomy={hackathons.find((item) => item.id === project.source_id)}
                    hearted={heartsQuery.data?.has(project.id) ?? false}
                    saved={savesQuery.data?.has(project.id) ?? false}
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
            {collapse(expanded, items.length, setExpanded)}
          </>
        )}
      </section>

      {isSelf ? (
        <section aria-label={t("userProfile.projects.saved")} className="flex flex-col gap-4">
          <UserProfileSectionHeader title={t("userProfile.projects.saved")} action={toggle(savedExpanded, savedItems.length, setSavedExpanded)} />
          {savedLoading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <Skeleton className="h-60 w-full rounded-md" />
              <Skeleton className="h-60 w-full rounded-md" />
            </div>
          ) : savedIdsQuery.isError || savedEntriesQuery.isError ? (
            <p className="text-sm text-foreground-muted">{t("userProfile.errors.loadFailed")}</p>
          ) : savedItems.length === 0 ? (
            <p className="text-sm text-foreground-muted">{t("userProfile.projects.savedEmpty")}</p>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                {savedVisible.map(({ project, owner }) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    {...cardProps}
                    taxonomy={hackathons.find((item) => item.id === project.source_id)}
                    hearted={heartsQuery.data?.has(project.id) ?? false}
                    saved={savesQuery.data?.has(project.id) ?? false}
                    ownerLabel={owner?.full_name ?? owner?.username}
                    ownerHandle={owner?.username ?? owner?.ocid}
                    ownerAvatarUrl={owner?.avatar_url}
                    ownerAvatarSeed={owner?.avatar_seed}
                    ownerAvatarConfig={owner?.avatar_config}
                    teamMembers={teamsQuery.data?.[project.id] ?? []}
                  />
                ))}
              </div>
              {collapse(savedExpanded, savedItems.length, setSavedExpanded)}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
