import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart as PhosphorHeart } from "@phosphor-icons/react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { projectHeartQueryOptions, projectSocialKeys } from "@/features/projects/projectSocialQueries";
import { toggleProjectHeart } from "@/lib/projectSocial";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";

export type ProjectSocialBlockProps = {
  projectId: string;
  likeCount: number;
  hearted?: boolean;
  className?: string;
  phosphorDuotone?: boolean;
};

export function ProjectSocialBlock({
  projectId,
  likeCount: initialLikeCount,
  hearted: heartedProp,
  className,
  phosphorDuotone = false,
}: ProjectSocialBlockProps) {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optimisticLike, setOptimisticLike] = useState<{
    projectId: string;
    baseCount: number;
    count: number;
  } | null>(null);
  const likeCount = optimisticLike?.projectId === projectId
    && optimisticLike.baseCount === initialLikeCount
    ? optimisticLike.count
    : initialLikeCount;
  const heartQuery = useQuery(
    projectHeartQueryOptions(user?.id, projectId, heartedProp === undefined),
  );
  const hearted = heartQuery.data ?? heartedProp ?? false;
  const heartMutation = useMutation({
    mutationFn: () => toggleProjectHeart(projectId),
    onSuccess: (next) => {
      if (user?.id) queryClient.setQueryData(projectSocialKeys.heart(user.id, projectId), next.hearted);
      if (next.awarded) {
        void queryClient.invalidateQueries({ queryKey: ["xp"] });
      }
      void queryClient.invalidateQueries({ queryKey: ["project-social", "hearts"] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  async function handleHeart() {
    if (!user) {
      toast.message(t("projects.social.loginToInteract"));
      return;
    }
    if (heartMutation.isPending) return;

    const wasHearted = hearted;
    setOptimisticLike({
      projectId,
      baseCount: initialLikeCount,
      count: Math.max(0, likeCount + (wasHearted ? -1 : 1)),
    });

    try {
      const result = await heartMutation.mutateAsync();
      if (result.hearted !== !wasHearted) setOptimisticLike(null);
    } catch (error) {
      setOptimisticLike(null);
      toast.error(error instanceof Error ? error.message : t("projects.social.heartFailed"));
    }
  }

  return (
    <div className={cn("border-t border-border-subtle pt-3", className)}>
      {phosphorDuotone ? (
        <div className={cn("inline-flex items-center gap-1.5", hearted && "text-rose-600")}>
          <PhosphorHeart
            className={cn(
              "size-5 cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              !hearted && "hover:text-foreground-muted",
              hearted && "fill-current [&>path:first-child]:opacity-100",
            )}
            weight="duotone"
            role="button"
            tabIndex={0}
            aria-disabled={heartMutation.isPending}
            aria-pressed={hearted}
            aria-label={hearted ? t("projects.social.unheart") : t("projects.social.heart")}
            onClick={() => void handleHeart()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void handleHeart();
              }
            }}
          />
          <span className="tabular-nums text-label-medium font-body">{likeCount}</span>
        </div>
      ) : (
        <Button
          type="button"
          variant="cta" hierarchy="tertiary"
          size="small"
          disabled={heartMutation.isPending}
          className={cn("gap-1.5", hearted && "text-rose-600")}
          onClick={() => void handleHeart()}
          aria-pressed={hearted}
          aria-label={hearted ? t("projects.social.unheart") : t("projects.social.heart")}
        >
          <Heart className={cn("size-4", hearted && "fill-current")} aria-hidden />
          <span className="tabular-nums text-label-medium font-body">{likeCount}</span>
        </Button>
      )}
    </div>
  );
}
