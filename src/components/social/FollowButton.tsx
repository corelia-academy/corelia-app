import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellPlus, Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { followSubject, isFollowing, unfollowSubject } from "@/lib/follows";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/authStore";
import type { FollowSubject } from "@/types/feed";

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
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState<number | null>(
    typeof followerCount === "number" ? followerCount : null,
  );
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectType = subject.type;
  const subjectId = subject.id;

  useEffect(() => {
    setCount(typeof followerCount === "number" ? followerCount : null);
  }, [followerCount]);

  useEffect(() => {
    if (!isAuthenticated || disabled) {
      setFollowing(initialFollowing);
      return;
    }

    let cancelled = false;
    setChecking(true);
    setError(null);
    void isFollowing({ type: subjectType, id: subjectId })
      .then((next) => {
        if (!cancelled) setFollowing(next);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("follow.errors.check"));
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [disabled, initialFollowing, isAuthenticated, subjectId, subjectType, t]);

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (disabled || saving) return;

    const nextFollowing = !following;
    const previousCount = count;
    const nextCount =
      previousCount === null
        ? null
        : Math.max(0, previousCount + (nextFollowing ? 1 : -1));
    setSaving(true);
    setError(null);
    setFollowing(nextFollowing);
    setCount(nextCount);

    try {
      const nextSubject = { type: subjectType, id: subjectId };
      if (nextFollowing) await followSubject(nextSubject);
      else await unfollowSubject(nextSubject);
      if (nextCount !== null) onFollowerCountChange?.(nextCount);
    } catch (e) {
      setFollowing(following);
      setCount(previousCount);
      setError(e instanceof Error ? e.message : t("follow.errors.save"));
    } finally {
      setSaving(false);
    }
  }, [
    count,
    disabled,
    following,
    isAuthenticated,
    location,
    navigate,
    onFollowerCountChange,
    saving,
    subjectId,
    subjectType,
    t,
  ]);

  const busy = checking || saving;
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
