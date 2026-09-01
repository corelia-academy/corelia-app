import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Bell, BellOff, BellPlus, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { followSubject, unfollowSubject } from "@/lib/follows";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { FollowSubject } from "@/types/feed";
import { followingStateQueryOptions, socialKeys } from "@/features/social/socialQueries";

interface FollowButtonProps {
  subject: FollowSubject;
  initialFollowing?: boolean;
  followerCount?: number | null;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
  showCount?: boolean;
  onFollowerCountChange?: (nextCount: number) => void;
}

export function FollowButton({
  subject,
  initialFollowing = false,
  followerCount = null,
  disabled = false,
  className,
  size = "default",
  showCount = true,
  onFollowerCountChange,
}: FollowButtonProps) {
  const { t } = useTranslation("feed");
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const subjectType = subject.type;
  const subjectId = subject.id;
  const baselineCount = typeof followerCount === "number" ? followerCount : null;
  const countContextKey = `${subjectType}:${subjectId}`;
  const [countOverride, setCountOverride] = useState<{
    contextKey: string;
    baseline: number | null;
    value: number | null;
  } | null>(null);
  const count = countOverride?.contextKey === countContextKey && countOverride.baseline === baselineCount
    ? countOverride.value
    : baselineCount;
  const [error, setError] = useState<string | null>(null);

  const nextSubject = { type: subjectType, id: subjectId } as FollowSubject;
  const followingQuery = useQuery(
    followingStateQueryOptions(user?.id, nextSubject, isAuthenticated && !disabled),
  );
  const following = followingQuery.data ?? initialFollowing;
  const mutation = useMutation({
    mutationFn: async (nextFollowing: boolean) => {
      if (nextFollowing) await followSubject(nextSubject);
      else await unfollowSubject(nextSubject);
      return nextFollowing;
    },
    onMutate: async (nextFollowing) => {
      if (!user?.id) return undefined;
      const key = socialKeys.followingState(user.id, nextSubject);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<boolean>(key) ?? initialFollowing;
      queryClient.setQueryData(key, nextFollowing);
      return { key, previous };
    },
    onError: (cause, _next, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
      setError(cause instanceof Error ? cause.message : t("follow.errors.save"));
    },
  });

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (disabled || mutation.isPending) return;

    const nextFollowing = !following;
    const previousCount = count;
    const nextCount =
      previousCount === null
        ? null
        : Math.max(0, previousCount + (nextFollowing ? 1 : -1));
    setError(null);
    setCountOverride({ contextKey: countContextKey, baseline: baselineCount, value: nextCount });

    try {
      await mutation.mutateAsync(nextFollowing);
      if (nextCount !== null) onFollowerCountChange?.(nextCount);
    } catch (e) {
      setCountOverride({ contextKey: countContextKey, baseline: baselineCount, value: previousCount });
      if (!(e instanceof Error)) setError(t("follow.errors.save"));
    }
  }, [
    count,
    baselineCount,
    countContextKey,
    disabled,
    following,
    isAuthenticated,
    location,
    navigate,
    onFollowerCountChange,
    mutation,
    t,
  ]);

  const busy = (isAuthenticated && followingQuery.isPending) || mutation.isPending;
  const Icon = busy ? Loader2 : following ? BellOff : BellPlus;
  const label = following ? t("follow.following") : t("follow.follow");
  const title = error ?? label;

  return (
    <Button
      type="button"
      size={size}
      variant={following ? "secondary" : "outline"}
      className={cn("gap-1.5", className)}
      aria-pressed={following}
      title={title}
      disabled={disabled || busy}
      onClick={() => void handleClick()}
    >
      {busy ? (
        <Icon className="size-4 animate-spin" aria-hidden />
      ) : following ? (
        <Icon className="size-4" aria-hidden />
      ) : (
        <Bell className="size-4" aria-hidden />
      )}
      <span>{label}</span>
      {showCount && count !== null ? (
        <span className="text-xs text-foreground-muted">{count}</span>
      ) : null}
    </Button>
  );
}
