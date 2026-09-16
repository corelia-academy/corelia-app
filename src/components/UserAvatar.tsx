import type { ReactNode } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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

  return (
    <Avatar className={className} size={size}>
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt={alt} className={imageClassName} />
      ) : null}
      <AvatarFallback className={cn("overflow-hidden", fallbackClassName)}>
        {generatedUrl ? (
          <img
            src={generatedUrl}
            alt={alt}
            className="size-full object-cover"
          />
        ) : (
          fallback
        )}
      </AvatarFallback>
    </Avatar>
  );
}
