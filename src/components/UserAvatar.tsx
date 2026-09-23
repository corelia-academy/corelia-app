import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  type AvatarSize,
} from "@/components/ui/avatar";
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
  size?: AvatarSize;
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
  const generatedUrl = useMemo(
    () => getGeneratedAvatarDataUrl(userId, avatarSeed),
    [userId, avatarSeed],
  );
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
      <AvatarFallback className={cn(fallbackClassName)}>
        {fallback}
      </AvatarFallback>
      {resolvedUrl ? (
        <AvatarImage
          key={resolvedUrl}
          src={resolvedUrl}
          alt={alt}
          onError={handleImageError}
          onLoadingStatusChange={(status) => {
            if (status === "error") handleImageError();
          }}
          className={cn(
            imageClassName,
          )}
        />
      ) : null}
    </Avatar>
  );
}
