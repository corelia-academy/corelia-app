import type { ReactNode } from "react";
import { Users } from "lucide-react";
import { ParticipantSummary } from "@/components/participants/ParticipantSummary";
import type { ParticipantPreviewData } from "@/components/participants/participantPreview";
import type { PublicHackathonApplicant } from "@/lib/hackathonApplicants";

const MAX_VISIBLE_APPLICANTS = 5;

type Props = {
  applicants?: PublicHackathonApplicant[];
  count?: number;
  label: string;
  participantPreview?: ParticipantPreviewData;
  summary?: string;
  emptyIcon?: ReactNode;
};

export function HackathonApplicantPreview({
  applicants = [],
  count = 0,
  label,
  participantPreview,
  summary,
  emptyIcon,
}: Props) {
  const total = Math.max(0, participantPreview?.count ?? count);
  const participants = participantPreview?.participants
    ?? applicants.slice(0, Math.min(MAX_VISIBLE_APPLICANTS, total)).map((applicant) => ({
      userId: applicant.user_id,
      avatarSeed: applicant.avatar_seed,
      avatarConfig: applicant.avatar_config,
      label: applicant.full_name?.trim() || applicant.username?.trim() || label,
    }));

  return (
    <div className="max-w-full min-w-0">
      <ParticipantSummary
        count={total}
        participants={participants}
        summary={summary ? <span className="text-sm">{summary}</span> : undefined}
        maxVisible={MAX_VISIBLE_APPLICANTS}
        showOverflow
        avatarSize="Small"
        groupLabel={`${label}: ${total}`}
        emptyContent={(
          <div className="flex items-center gap-2">
            {emptyIcon ?? <Users className="size-5 text-foreground-muted" aria-hidden />}
            <span className="text-lg font-semibold text-foreground tabular-nums">{total}</span>
          </div>
        )}
        className="min-h-6 gap-1.5"
      />
    </div>
  );
}
