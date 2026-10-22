import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkSimpleIcon as PhosphorBookmark } from "@phosphor-icons/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { projectSaveKeys, projectSaveQueryOptions } from "@/features/projects/projectSaveQueries";
import { setProjectSaved } from "@/lib/projectSaves";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";

type OptimisticSave = {
  projectId: string;
  baseCount: number;
  count: number;
};

type OptimisticSaved = {
  projectId: string;
  saved: boolean;
};

export type ProjectSaveBlockProps = {
  projectId: string;
  saved?: boolean;
  saveStateReady?: boolean;
  saveCount: number;
};

export function ProjectSaveBlock({
  projectId,
  saved,
  saveStateReady = false,
  saveCount,
}: ProjectSaveBlockProps) {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const saveQuery = useQuery(
    projectSaveQueryOptions(user?.id, projectId, saved === undefined),
  );
  const safeSaveCount = Math.max(0, saveCount);
  const [optimisticSave, setOptimisticSave] = useState<OptimisticSave | null>(null);
  const [optimisticSaved, setOptimisticSaved] = useState<OptimisticSaved | null>(null);
  const currentOptimisticSave = optimisticSave?.projectId === projectId
    && optimisticSave.baseCount === safeSaveCount
    ? optimisticSave
    : null;
  const currentSaved = optimisticSaved?.projectId === projectId
    ? optimisticSaved.saved
    : saveQuery.data ?? saved ?? false;
  const displayedCount = Math.max(
    0,
    currentOptimisticSave?.count ?? safeSaveCount,
  );

  const saveMutation = useMutation({
    mutationFn: (nextSaved: boolean) => setProjectSaved(projectId, nextSaved),
    onSuccess: (result) => {
      if (user?.id) {
        queryClient.setQueryData(
          projectSaveKeys.project(user.id, projectId),
          result.saved,
        );
      }
      setOptimisticSaved(null);
      void queryClient.invalidateQueries({ queryKey: projectSaveKeys.all });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  async function handleSave() {
    if (!user) {
      toast.message(t("projects.social.loginToSave"));
      return;
    }
    if (!saveStateReady || saveMutation.isPending) return;

    const nextSaved = !currentSaved;
    setOptimisticSaved({ projectId, saved: nextSaved });
    setOptimisticSave({
      projectId,
      baseCount: safeSaveCount,
      count: Math.max(0, displayedCount + (nextSaved ? 1 : -1)),
    });

    try {
      const result = await saveMutation.mutateAsync(nextSaved);
      if (!result.changed) {
        setOptimisticSave(null);
      }
    } catch (error) {
      setOptimisticSaved(null);
      setOptimisticSave(null);
      toast.error(
        error instanceof Error && error.message !== "project_save_requires_authentication"
          ? error.message
          : t("projects.social.saveFailed"),
      );
    }
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-2">
      <PhosphorBookmark
        className={cn(
          "size-5 shrink-0 cursor-pointer text-foreground focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          !currentSaved && "hover:text-foreground-muted",
          currentSaved && "fill-current text-primary [&>path:first-child]:opacity-100",
        )}
        weight="duotone"
        role="button"
        tabIndex={0}
        aria-label={t(currentSaved ? "projects.social.unsave" : "projects.social.save")}
        aria-pressed={currentSaved}
        aria-disabled={saveMutation.isPending || (Boolean(user) && !saveStateReady)}
        onClick={handleSave}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleSave();
          }
        }}
      />
      {displayedCount > 0 ? (
        <span className="tabular-nums text-body-medium font-body leading-[1.4] text-foreground-subtle">
          {displayedCount}
        </span>
      ) : null}
    </span>
  );
}
