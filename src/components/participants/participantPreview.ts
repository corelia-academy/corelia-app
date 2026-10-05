import type { AvatarConfig } from "@/lib/avatar";

export type ParticipantPreviewPerson = {
  userId: string;
  avatarSeed?: string | null;
  avatarConfig?: AvatarConfig | null;
  label?: string;
};

export type ParticipantPreviewData = {
  count: number;
  participants: ParticipantPreviewPerson[];
};

/** Creates temporary display data at the call site until real counts are available. */
export function createMockParticipantPreview(
  entityId: string,
  avatarCount = 3,
): ParticipantPreviewData {
  return {
    count: 1_000 + Math.floor(Math.random() * 8_001),
    participants: Array.from(
      { length: avatarCount },
      (_, index) => ({ userId: `mock-participant-${entityId}-${index}` }),
    ),
  };
}

export function formatCompactParticipantCount(count: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 0,
  })
    .format(count)
    .toLowerCase();
}
