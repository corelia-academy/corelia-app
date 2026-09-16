import { useEffect, useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { getGeneratedAvatarDataUrl } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  userId?: string | null;
  avatarUrl?: string | null;
  avatarSeed?: string | null;
  alt: string;
  fallback?: ReactNode;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  size?: "default" | "sm" | "lg";
};

export function UserAvatar({
  userId,
  avatarUrl,
  avatarSeed,
  alt,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
  size,
}: UserAvatarProps) {
  const generatedUrl = getGeneratedAvatarDataUrl(userId, avatarSeed);
  const customUrl = avatarUrl?.trim() || null;
  const primaryUrl = customUrl ?? generatedUrl;
  const [resolvedUrl, setResolvedUrl] = useState(primaryUrl);

  useEffect(() => {
    setResolvedUrl(primaryUrl);
  }, [primaryUrl]);

  function handleImageError() {
    if (customUrl && resolvedUrl === customUrl && generatedUrl) {
      setResolvedUrl(generatedUrl);
      return;
    }
    setResolvedUrl(null);
  }

  return (
    <Avatar className={className} size={size}>
      <span
        data-slot="avatar-fallback"
        className={cn(
          "absolute inset-0 z-0 flex size-full items-center justify-center overflow-hidden rounded-full bg-surface-raised text-sm text-foreground-muted group-data-[size=sm]/avatar:text-xs",
          fallbackClassName,
        )}
      >
        {fallback}
      </span>
      {resolvedUrl ? (
        <img
          key={resolvedUrl}
          data-slot="avatar-image"
          src={resolvedUrl}
          alt={alt}
          onError={handleImageError}
          className={cn(
            "pointer-events-none absolute inset-0 z-10 aspect-square size-full rounded-full object-cover",
            imageClassName,
          )}
        />
      ) : null}
    </Avatar>
  );
}
