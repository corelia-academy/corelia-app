import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import {
  createProjectCollaborationInvite,
  listCollaborationProfiles,
  listProjectCollaborationInvites,
  listProjectCollaborators,
  listProjectTeamCandidates,
  removeProjectCollaborator,
  revokeProjectCollaborationInvite,
} from "@/lib/projectCollaboration";

type Props = {
  projectId: string;
  sourceType: string;
  sourceId?: string | null;
  persisted: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
};

export function ProjectTeamEditor({
  projectId,
  sourceType,
  sourceId,
  persisted,
  selectedIds = [],
  onSelectedIdsChange,
}: Props) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const key = ["project-team", projectId] as const;
  const candidatesQuery = useQuery({
    queryKey: [...key, "candidates", sourceType, sourceId],
    queryFn: () => listProjectTeamCandidates({ projectId, sourceType, sourceId }),
    staleTime: 30_000,
  });
  const teamQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [members, invites] = await Promise.all([
        listProjectCollaborators(projectId),
        listProjectCollaborationInvites(projectId),
      ]);
      const ids = [...members.map((item) => item.user_id), ...invites.map((item) => item.invitee_user_id)];
      return { members, invites, profiles: await listCollaborationProfiles(ids) };
    },
    enabled: persisted,
  });
  const options = useMemo(() => (candidatesQuery.data ?? []).map((profile) => ({
    id: profile.user_id,
    label: profile.full_name?.trim() || profile.username?.trim() || profile.user_id,
    description: profile.username ? `@${profile.username}` : null,
  })), [candidatesQuery.data]);

  const inviteMutation = useMutation({
    mutationFn: (userId: string) => createProjectCollaborationInvite(projectId, userId),
    onSuccess: async () => {
      toast.success(t("projects.team.invited"));
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("projects.team.actionFailed")),
  });
  const revokeMutation = useMutation({
    mutationFn: revokeProjectCollaborationInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(error instanceof Error ? error.message : t("projects.team.actionFailed")),
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeProjectCollaborator(projectId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(error instanceof Error ? error.message : t("projects.team.actionFailed")),
  });

  const team = teamQuery.data;
  const pending = team?.invites.filter((invite) => invite.status === "pending") ?? [];

  return (
    <fieldset className="space-y-3">
      <div>
        <legend className="text-sm font-medium">{t("projects.team.title")}</legend>
        <p className="mt-1 text-xs text-foreground-muted">{t("projects.team.hint")}</p>
      </div>
      <ProfileCombobox
        title={t("projects.team.pickTitle")}
        description={t("projects.team.pickDescription")}
        options={options}
        placeholder={t("projects.team.placeholder")}
        emptyLabel={candidatesQuery.isPending ? t("projects.team.loading") : t("projects.team.empty")}
        value={persisted ? "" : selectedIds}
        multiple={!persisted}
        onChange={(value) => {
          if (persisted) {
            const id = Array.isArray(value) ? value[0] : value;
            if (id) inviteMutation.mutate(id);
          } else {
            onSelectedIdsChange?.(Array.isArray(value) ? value : value ? [value] : []);
          }
        }}
      />
      {!persisted && selectedIds.length ? (
        <p className="text-xs text-foreground-muted">{t("projects.team.inviteAfterSave")}</p>
      ) : null}
      {persisted && teamQuery.isPending ? <p className="text-sm text-foreground-muted">{t("projects.team.loading")}</p> : null}
      {persisted && pending.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("projects.team.pending")}</p>
          <ul className="mt-2 space-y-2">
            {pending.map((invite) => {
              const profile = team?.profiles[invite.invitee_user_id];
              return <li key={invite.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span>{profile?.full_name || profile?.username || invite.invitee_user_id}</span>
                <Button type="button" size="sm" variant="ghost" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate(invite.id)}><X className="size-4" />{t("projects.team.revoke")}</Button>
              </li>;
            })}
          </ul>
        </div>
      ) : null}
      {persisted && team?.members.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("projects.team.members")}</p>
          <ul className="mt-2 space-y-2">
            {team.members.map((member) => {
              const profile = team.profiles[member.user_id];
              return <li key={member.user_id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><UserPlus className="size-4" />{profile?.full_name || profile?.username || member.user_id}</span>
                <Button type="button" size="sm" variant="ghost" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate(member.user_id)}><Trash2 className="size-4" />{t("projects.team.remove")}</Button>
              </li>;
            })}
          </ul>
        </div>
      ) : null}
    </fieldset>
  );
}
