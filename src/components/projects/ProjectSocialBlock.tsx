import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
};

export function ProjectSocialBlock({
  projectId,
  likeCount: initialLikeCount,
  hearted: heartedProp,
  className,
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
      if (user?.id) queryClient.setQueryData(projectSocialKeys.heart(user.id, projectId), next);
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
      const nowHearted = await heartMutation.mutateAsync();
      if (nowHearted !== !wasHearted) setOptimisticLike(null);
    } catch (error) {
      setOptimisticLike(null);
      toast.error(error instanceof Error ? error.message : t("projects.social.heartFailed"));
    }
  }

  return (
    <div className={cn("border-t border-border-subtle pt-3", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={heartMutation.isPending}
        className={cn("gap-1.5", hearted && "text-rose-600")}
        onClick={() => void handleHeart()}
        aria-pressed={hearted}
        aria-label={hearted ? t("projects.social.unheart") : t("projects.social.heart")}
      >
        <Heart className={cn("size-4", hearted && "fill-current")} aria-hidden />
        <span className="tabular-nums text-sm font-medium">{likeCount}</span>
      </Button>
    </div>
  );
}
