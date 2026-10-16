import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Trash2, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { UserAvatar } from "@/components/UserAvatar";
import { Action } from "@/components/ui/action";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import type { ProfileComboboxOption } from "@/components/ui/profile-combobox";
import { Separator } from "@/components/ui/separator";
import {
  createProjectCollaborationInvite,
  listCollaborationProfiles,
  listProjectCollaborationInvites,
  listProjectCollaborators,
  listProjectTeamCandidates,
  removeProjectCollaborator,
  revokeProjectCollaborationInvite,
  sendProjectCollaborationInviteEmail,
} from "@/lib/projectCollaboration";

import { MAX_PROJECT_TEAM_SIZE } from "@/types/projects";

type Props = {
  projectId: string;
  ownerId?: string;
  sourceType: string;
  sourceId?: string | null;
  persisted: boolean;
  editsClosed?: boolean;
  lateMembersAllowed?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  presentation?: "default" | "submission";
};

type TeamProfileOption = ProfileComboboxOption & {
  userId: string;
  avatarUrl?: string | null;
  avatarAlt: string;
};

export function ProjectTeamEditor({
  projectId,
  ownerId,
  sourceType,
  sourceId,
  persisted,
  editsClosed = false,
  lateMembersAllowed = false,
  selectedIds = [],
  onSelectedIdsChange,
  presentation = "default",
}: Props) {
  const { t } = useTranslation("common");
  const hackathon = sourceType === "hackathon" || sourceType === "contest";
  const queryClient = useQueryClient();
  const key = ["project-team", projectId] as const;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<TeamProfileOption[]>([]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim().replace(/^@+/, ""));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const candidatesQuery = useQuery({
    queryKey: [...key, "candidates", sourceType, sourceId, debouncedSearch, lateMembersAllowed],
    queryFn: () => listProjectTeamCandidates({ projectId, sourceType, sourceId, search: debouncedSearch }),
    staleTime: 30_000,
    enabled: !editsClosed,
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
  const candidateOptions = useMemo(() => (candidatesQuery.data ?? []).map((profile) => ({
    id: profile.user_id,
    label: profile.full_name?.trim() || profile.username?.trim() || profile.user_id,
    description: profile.username ? `@${profile.username}` : null,
    icon: <UserAvatar userId={profile.user_id} avatarUrl={profile.avatar_url} alt={profile.full_name?.trim() || profile.username?.trim() || profile.user_id} size="sm" />,
    userId: profile.user_id,
    avatarUrl: profile.avatar_url,
    avatarAlt: profile.full_name?.trim() || profile.username?.trim() || profile.user_id,
  })), [candidatesQuery.data]);
  const options = useMemo(() => {
    const candidateIds = new Set(candidateOptions.map((option) => option.id));
    return [
      ...selectedOptions.filter((option) => selectedIds.includes(option.id) && !candidateIds.has(option.id)),
      ...candidateOptions,
    ];
  }, [candidateOptions, selectedIds, selectedOptions]);

  const inviteMutation = useMutation({
    mutationFn: (userId: string) => createProjectCollaborationInvite(projectId, userId),
    onSuccess: async () => {
      toast.success(t("projects.team.invited"));
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes("project_team_full")) {
        toast.error(t("projects.team.full"));
        void queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      toast.error(error instanceof Error ? error.message : t("projects.team.actionFailed"));
    },
  });
  const revokeMutation = useMutation({
    mutationFn: revokeProjectCollaborationInvite,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(error instanceof Error ? error.message : t("projects.team.actionFailed")),
  });
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeProjectCollaborator(projectId, userId),
    onSuccess: async () => {
      setRemovingUserId(null);
      await queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("projects.team.actionFailed")),
  });

  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      setResendingInviteId(inviteId);
      return await sendProjectCollaborationInviteEmail({ inviteId });
    },
    onSuccess: (res) => {
      if (res.idempotent_replay) {
        toast.info(t("projects.team.emailAlreadySent"));
      } else if (res.email_sent) {
        toast.success(t("projects.team.emailSent"));
      } else {
        toast.info(t("projects.team.emailSkipped"));
      }
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("rate_limited")) {
        toast.error(t("projects.team.emailRateLimited"));
      } else if (msg.includes("rejected") || msg.includes("permanent")) {
        toast.error(t("projects.team.emailPermanentError"));
      } else if (msg.includes("reconciliation") || msg.includes("indeterminate")) {
        toast.error(t("projects.team.emailIndeterminateError"));
      } else {
        toast.error(t("projects.team.emailRetryableError"));
      }
    },
    onSettled: () => {
      setResendingInviteId(null);
    },
  });

  const team = teamQuery.data;
  const memberCount = 1 + (persisted ? (team?.members.filter((member) => member.user_id !== ownerId).length ?? 0) : selectedIds.length);
  const atCapacity = memberCount >= MAX_PROJECT_TEAM_SIZE;
  const pending = team?.invites.filter((invite) => invite.status === "pending") ?? [];
  const [showAllPending, setShowAllPending] = useState(false);
  const visiblePending = showAllPending ? pending : pending.slice(0, 5);

  return (
    <fieldset className="space-y-3">
      {presentation === "default" ? <div>
        <legend className="text-sm font-medium">{t("projects.team.title")}</legend>
        <p className="mt-1 text-xs text-foreground-muted">{t("projects.team.hint")}</p>
        <p className="mt-1 text-xs text-foreground-muted">{t("projects.team.limit", { count: MAX_PROJECT_TEAM_SIZE })}</p>
        {persisted && atCapacity ? <p role="status" className="mt-1 text-xs text-foreground-muted">{t("projects.team.full")}</p> : null}
        {hackathon ? (
          <p className="mt-1 text-xs text-foreground-muted">{t(lateMembersAllowed ? "projects.team.lateMembersHint" : "projects.team.hackathonEligibleHint")}</p>
        ) : null}
      </div> : null}
      {!editsClosed && (!persisted || (!atCapacity && teamQuery.isSuccess)) ? <ProfileCombobox
        presentation={presentation === "submission" ? "inline" : "dialog"}
        title={t("projects.team.pickTitle")}
        description={hackathon && !lateMembersAllowed ? t("projects.team.hackathonPickDescription") : t("projects.team.pickDescription")}
        options={options}
        onSearchChange={setSearch}
        errorMessage={candidatesQuery.isError ? t("projects.team.loadError") : undefined}
        placeholder={t("projects.team.placeholder")}
        searchPlaceholder={t("projects.team.searchPlaceholder")}
        emptyLabel={candidatesQuery.isPending || search.trim().replace(/^@+/, "") !== debouncedSearch ? t("projects.team.loading") : t("projects.team.empty")}
        value={persisted || presentation === "submission" ? "" : selectedIds}
        multiple={!persisted && presentation !== "submission"}
        onChange={(value) => {
          if (persisted) {
            const id = Array.isArray(value) ? value[0] : value;
            if (id) inviteMutation.mutate(id);
          } else if (presentation === "submission") {
            const id = Array.isArray(value) ? value[0] : value;
            if (!id || selectedIds.includes(id)) return;
            if (memberCount >= MAX_PROJECT_TEAM_SIZE) {
              toast.error(t("projects.team.full"));
              return;
            }
            const option = options.find((item) => item.id === id);
            if (!option) return;
            setSelectedOptions((current) => current.some((item) => item.id === id) ? current : [...current, option]);
            onSelectedIdsChange?.([...selectedIds, id]);
          } else {
            const ids = Array.isArray(value) ? value : value ? [value] : [];
            if (ids.length >= MAX_PROJECT_TEAM_SIZE) {
              toast.error(t("projects.team.full"));
              return;
            }
            setSelectedOptions(options.filter((option) => ids.includes(option.id)));
            onSelectedIdsChange?.(ids);
          }
        }}
      /> : null}
      {!persisted && presentation === "submission" && selectedIds.length > 0 ? (
        <section className="pt-2" aria-label={t("projects.team.selectedCount", { count: selectedIds.length })}>
          <p className="mb-2 text-label-large font-semibold text-foreground-muted">
            {t("projects.team.selectedCount", { count: selectedIds.length })}
          </p>
          <ul>
            {selectedIds.map((id, index) => {
              const option = options.find((item) => item.id === id);
              if (!option) return null;
              return (
                <li key={id}>
                  <Action
                    nativeButton={false}
                    render={<div />}
                    size="small"
                    className="min-h-[60px] hover:bg-transparent [&>span:first-child]:!size-10"
                    icon={<UserAvatar userId={option.userId} avatarUrl={option.avatarUrl} alt={option.avatarAlt} size="Large" />}
                    label={option.label}
                    supportingText={option.description ?? undefined}
                    trailingGroup={(
                      <Button
                        type="button"
                        size="xsmall"
                        variant="cta"
                        hierarchy="tertiary"
                        className="cursor-pointer hover:bg-transparent hover:text-foreground-muted"
                        aria-label={t("projects.team.removeNamedFromList", { name: option.label })}
                        onClick={() => {
                          onSelectedIdsChange?.(selectedIds.filter((selectedId) => selectedId !== id));
                          setSelectedOptions((current) => current.filter((item) => item.id !== id));
                        }}
                      >
                        <X className="size-3" aria-hidden />
                        {t("projects.team.removeFromList")}
                      </Button>
                    )}
                  />
                  {index < selectedIds.length - 1 ? <Separator /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {!persisted && presentation === "submission" && selectedIds.length === 0 && !search.trim() ? (
        <p className="text-body-small text-foreground-muted">{t("projects.editor.noTeam")}</p>
      ) : null}
      {!persisted && selectedIds.length ? (
        <p className="text-xs text-foreground-muted">{t("projects.team.inviteAfterSave")}</p>
      ) : null}
      {persisted && teamQuery.isPending ? <p className="text-sm text-foreground-muted">{t("projects.team.loading")}</p> : null}
      {persisted && pending.length ? (
        <section className="pt-2" aria-label={t("projects.team.invitedCount", { count: pending.length })}>
          <p className="mb-2 text-label-large font-semibold text-foreground-muted">
            {t("projects.team.invitedCount", { count: pending.length })}
          </p>
          <ul>
            {visiblePending.map((invite, index) => {
              const profile = team?.profiles[invite.invitee_user_id];
              const label = profile?.full_name?.trim() || profile?.username?.trim() || invite.invitee_user_id;
              const isResending = resendInviteMutation.isPending && resendingInviteId === invite.id;
              return (
                <li key={invite.id}>
                  <Action
                    nativeButton={false}
                    render={<div />}
                    size="small"
                    className="min-h-[60px] hover:bg-transparent [&>span:first-child]:!size-10"
                    icon={<UserAvatar userId={invite.invitee_user_id} avatarUrl={profile?.avatar_url} alt={label} size="Large" />}
                    label={label}
                    supportingText={profile?.username ? `@${profile.username}` : undefined}
                    badge={<span className="text-body-small text-foreground-muted">{t("projects.team.invitedStatus")}</span>}
                    trailingGroup={(
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="xsmall"
                          variant="cta"
                          hierarchy="tertiary"
                          iconOnly
                          aria-label={t("projects.team.resendEmailFor", { name: label })}
                          disabled={isResending}
                          onClick={() => resendInviteMutation.mutate(invite.id)}
                        >
                          {isResending ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Mail className="size-3" aria-hidden />}
                        </Button>
                        <Button
                          type="button"
                          size="xsmall"
                          variant="cta"
                          hierarchy="tertiary"
                          className="cursor-pointer hover:bg-transparent hover:text-foreground-muted"
                          aria-label={t("projects.team.removeNamedFromList", { name: label })}
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(invite.id)}
                        >
                          <X className="size-3" aria-hidden />
                          {t("projects.team.removeFromList")}
                        </Button>
                      </div>
                    )}
                  />
                  {index < visiblePending.length - 1 ? <Separator /> : null}
                </li>
              );
            })}
          </ul>
          {pending.length > 5 ? (
            <div className="flex justify-center pt-2">
              <Button type="button" size="xsmall" variant="cta" hierarchy="tertiary" onClick={() => setShowAllPending((current) => !current)}>
                {t(showAllPending ? "projects.team.showLess" : "projects.team.showMore")}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
      {persisted && team?.members.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("projects.team.members")}</p>
          <ul className="mt-2 space-y-2">
            {team.members.map((member) => {
              const profile = team.profiles[member.user_id];
              return <li key={member.user_id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-2"><UserPlus className="size-4" />{profile?.full_name || profile?.username || member.user_id}</span>
                <Button type="button" size="small" variant="cta" hierarchy="tertiary" disabled={editsClosed || removeMutation.isPending} onClick={() => setRemovingUserId(member.user_id)}><Trash2 className="size-4" />{t("projects.team.remove")}</Button>
              </li>;
            })}
          </ul>
        </div>
      ) : null}
      <Dialog open={removingUserId !== null} onOpenChange={(next) => { if (!removeMutation.isPending && !next) setRemovingUserId(null); }}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!removeMutation.isPending}>
          <DialogTitle>{t("projects.team.removeMemberTitle")}</DialogTitle>
          <DialogDescription>{t("projects.team.removeMemberConfirm")}</DialogDescription>
          <DialogFooter>
            <Button type="button" variant="cta" hierarchy="secondary" disabled={editsClosed || removeMutation.isPending} onClick={() => setRemovingUserId(null)}>
              {t("actions.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={editsClosed || removeMutation.isPending} onClick={() => {
              if (removingUserId && !editsClosed) removeMutation.mutate(removingUserId);
            }}>
              {removeMutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t(removeMutation.isPending ? "projects.team.removingMember" : "projects.team.removeMemberAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </fieldset>
  );
}
