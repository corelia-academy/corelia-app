import { Users } from "lucide-react";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import type { PublicHackathonApplicant } from "@/lib/hackathonApplicants";

const MAX_VISIBLE_APPLICANTS = 5;

type Props = {
  applicants?: PublicHackathonApplicant[];
  count: number;
  label: string;
};

export function HackathonApplicantPreview({ applicants = [], count, label }: Props) {
  const total = Math.max(0, count);
  const visible = applicants.slice(0, Math.min(MAX_VISIBLE_APPLICANTS, total));
  const remaining = Math.max(0, total - visible.length);
  return (
    <div className="w-fit max-w-full min-w-0">
      <p className="text-xs text-foreground-muted">{label}</p>
      <div className="mt-1 flex min-h-8 min-w-0 items-center">
        {visible.length ? (
          <AvatarGroup aria-label={`${label}: ${total}`} className="min-w-0">
            {visible.map((applicant) => {
              const name = applicant.full_name?.trim() || applicant.username?.trim() || label;
              return (
                <span key={applicant.user_id} title={name} aria-label={name}>
                  <UserAvatar
                    userId={applicant.user_id}
                    avatarSeed={applicant.avatar_seed}
                    avatarConfig={applicant.avatar_config}
                    alt={name}
                    fallback={name.charAt(0).toUpperCase()}
                  />
                </span>
              );
            })}
            {remaining > 0 ? <AvatarGroupCount className="w-auto min-w-8 px-1" aria-label={`+${remaining}`}>+{remaining}</AvatarGroupCount> : null}
          </AvatarGroup>
        ) : <Users className="size-5 text-foreground-muted" aria-hidden />}
        {!visible.length ? <span className="ml-2 text-lg font-semibold text-foreground tabular-nums">{total}</span> : null}
      </div>
    </div>
  );
}
