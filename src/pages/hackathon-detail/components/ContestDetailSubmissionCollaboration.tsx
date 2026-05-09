import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileCombobox } from "@/components/ui/profile-combobox";
import { Input } from "@/components/ui/input";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";
import { supabase } from "@/lib/supabase";

type ProfileMini = {
  id: string;
  username: string | null;
  full_name: string | null;
};

export function ContestDetailSubmissionCollaboration({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    translate,
    collabProject,
    collabMembers,
    collabInvites,
    collabLoading,
    collabInviteeQuery,
    setCollabInviteeQuery,
    invitableUsers,
    invitableLoading,
    inviteSendingUserId,
    handleSendCollaborationInvite,
    handleRevokeCollabInvite,
    handleRemoveCollaborator,
    user,
  } = vm;

  const [profilesById, setProfilesById] = useState<Record<string, ProfileMini>>({});

  const userIdsToResolve = useMemo(() => {
    const ids = new Set<string>();
    for (const m of collabMembers) {
      ids.add(m.user_id);
    }
    for (const inv of collabInvites) {
      ids.add(inv.invitee_user_id);
    }
    return Array.from(ids);
  }, [collabMembers, collabInvites]);

  useEffect(() => {
    if (userIdsToResolve.length === 0) {
      queueMicrotask(() => setProfilesById({}));
      return;
    }
    let cancelled = false;
    void supabase
      .from("public_profiles")
      .select("id,username,full_name")
      .in("id", userIdsToResolve)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next: Record<string, ProfileMini> = {};
        for (const row of data as ProfileMini[]) {
          next[row.id] = row;
        }
        setProfilesById(next);
      });
    return () => {
      cancelled = true;
    };
  }, [userIdsToResolve]);

  const comboboxOptions = useMemo(
    () =>
      invitableUsers.map((u) => ({
        id: u.user_id,
        label:
          u.full_name?.trim() ||
          u.username?.trim() ||
          translate("detail.collaboration.unnamedUser"),
        description: u.username ? `@${u.username}` : u.user_id,
      })),
    [invitableUsers, translate],
  );

  if (!collabProject && !collabLoading) {
    return (
      <div className="rounded-md border border-border-subtle bg-surface-base px-4 py-3 text-sm text-foreground-muted">
        {translate("detail.collaboration.saveSubmissionFirst")}
      </div>
    );
  }

  if (collabLoading && !collabProject) {
    return (
      <div className="text-sm text-foreground-muted">
        {translate("common:status.loading")}
      </div>
    );
  }

  if (!collabProject) return null;

  return (
    <div className="space-y-4 rounded-md border border-border-subtle bg-surface-base p-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          {translate("detail.collaboration.sectionTitle")}
        </h3>
      </div>
      <p className="text-xs leading-relaxed text-foreground-muted">
        {translate("detail.collaboration.sectionBody")}
      </p>
      <p className="text-xs text-foreground-muted">
        {translate("detail.collaboration.leadLine")}
      </p>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground-muted">
          {translate("detail.collaboration.searchLabel")}
        </label>
        <Input
          value={collabInviteeQuery}
          onChange={(e) => setCollabInviteeQuery(e.target.value)}
          placeholder={translate("detail.collaboration.searchPlaceholder")}
          className="h-10"
        />
        <ProfileCombobox
          title={translate("detail.collaboration.pickTitle")}
          description={translate("detail.collaboration.pickDescription")}
          options={comboboxOptions}
          placeholder={translate("detail.collaboration.pickPlaceholder")}
          searchPlaceholder={translate("detail.collaboration.pickSearchPlaceholder")}
          emptyLabel={translate("detail.collaboration.pickEmpty")}
          value=""
          onChange={(next) => {
            const uid = Array.isArray(next) ? next[0] : next;
            if (uid) void handleSendCollaborationInvite(uid);
          }}
        />
        {invitableLoading ? (
          <p className="text-xs text-foreground-muted">{translate("common:status.loading")}</p>
        ) : null}
      </div>

      {collabInvites.filter((i) => i.status === "pending").length > 0 ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {translate("detail.collaboration.pendingInvites")}
          </div>
          <ul className="mt-2 space-y-2">
            {collabInvites
              .filter((i) => i.status === "pending")
              .map((inv) => {
                const p = profilesById[inv.invitee_user_id];
                const label =
                  p?.full_name?.trim() ||
                  p?.username?.trim() ||
                  inv.invitee_user_id;
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{label}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={Boolean(inviteSendingUserId)}
                      onClick={() => void handleRevokeCollabInvite(inv.id)}
                    >
                      {translate("detail.collaboration.revokeInvite")}
                    </Button>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : null}

      {collabMembers.length > 0 ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-foreground-muted">
            {translate("detail.collaboration.members")}
          </div>
          <ul className="mt-2 space-y-2">
            {collabMembers.map((m) => {
              const p = profilesById[m.user_id];
              const label =
                m.user_id === user?.id
                  ? translate("detail.collaboration.youContributor")
                  : p?.full_name?.trim() ||
                    p?.username?.trim() ||
                    m.user_id;
              return (
                <li
                  key={m.user_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm"
                >
                  <span className="text-foreground">{label}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void handleRemoveCollaborator(m.user_id)}
                  >
                    {translate("detail.collaboration.removeMember")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
