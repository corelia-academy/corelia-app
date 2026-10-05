import type { ReactNode } from "react";

import { AvatarGroup, AvatarGroupCount, type AvatarSize } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import type { ParticipantPreviewPerson } from "@/components/participants/participantPreview";
import { cn } from "@/lib/utils";

type Props = {
  count: number;
  participants: ParticipantPreviewPerson[];
  summary?: ReactNode;
  emptyContent?: ReactNode;
  maxVisible?: number;
  showOverflow?: boolean;
  avatarSize?: AvatarSize;
  groupLabel?: string;
  className?: string;
};

export function ParticipantSummary({
  count,
  participants,
  summary,
  emptyContent,
  maxVisible = 3,
  showOverflow = false,
  avatarSize = "Small",
  groupLabel,
  className,
}: Props) {
  const total = Math.max(0, count);
  const visibleParticipants = participants.slice(0, Math.min(maxVisible, total));
  const remaining = Math.max(0, total - visibleParticipants.length);

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {visibleParticipants.length > 0 ? (
        <AvatarGroup
          aria-label={groupLabel}
          aria-hidden={groupLabel ? undefined : true}
          className={cn("shrink-0", avatarSize === "Small" && "h-6")}
        >
          {visibleParticipants.map((participant) => {
            const avatar = (
              <UserAvatar
                key={participant.userId}
                userId={participant.userId}
                avatarSeed={participant.avatarSeed}
                avatarConfig={participant.avatarConfig}
                alt={participant.label ?? ""}
                fallback={participant.label?.charAt(0).toUpperCase()}
                size={avatarSize}
              />
            );

            return participant.label ? (
              <span
                key={participant.userId}
                title={participant.label}
                aria-label={participant.label}
              >
                {avatar}
              </span>
            ) : (
              avatar
            );
          })}
          {showOverflow && remaining > 0 ? (
            <AvatarGroupCount className="w-auto min-w-8 px-1" aria-label={`+${remaining}`}>
              +{remaining}
            </AvatarGroupCount>
          ) : null}
        </AvatarGroup>
      ) : emptyContent ? (
        emptyContent
      ) : null}
      {summary ? (
        <span className="min-w-0 text-xs text-foreground-muted">{summary}</span>
      ) : null}
    </div>
  );
}
