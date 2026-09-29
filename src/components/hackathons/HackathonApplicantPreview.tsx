import { Users } from "lucide-react";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import type { PublicHackathonApplicant } from "@/lib/hackathonApplicants";

type Props = {
  applicants?: PublicHackathonApplicant[];
  count: number;
  label: string;
};

export function HackathonApplicantPreview({ applicants = [], count, label }: Props) {
  const visible = applicants.slice(0, 3);
  return (
    <div className="min-w-0">
      <p className="text-xs text-foreground-muted">{label}</p>
      <div className="mt-1 flex min-h-8 items-center gap-2.5">
        {visible.length ? (
          <AvatarGroup aria-label={label}>
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
            {count > visible.length ? <AvatarGroupCount className="w-auto min-w-8 px-1" aria-hidden>+{count - visible.length}</AvatarGroupCount> : null}
          </AvatarGroup>
        ) : <Users className="size-5 text-foreground-muted" aria-hidden />}
        <span className="text-lg font-semibold text-foreground tabular-nums">{count}</span>
      </div>
    </div>
  );
}
