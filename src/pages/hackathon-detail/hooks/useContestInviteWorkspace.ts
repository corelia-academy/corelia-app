import { useCallback, useState } from "react";
import type {
  ContestAccessInvite,
  ContestScopedViewerRole,
} from "@/types/hackathons";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";

export function useContestInviteWorkspace() {
  const [invites, setInvites] = useState<ContestAccessInvite[]>([]);
  const [myInvite, setMyInvite] = useState<ContestAccessInvite | null>(null);
  const [savingInvite, setSavingInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteOrganization, setInviteOrganization] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [inviteRoles, setInviteRoles] = useState<ContestScopedViewerRole[]>([
    "judge",
  ]);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  const hydrateFromPayload = useCallback((payload: ContestDetailFetchedPayload) => {
    setInvites(payload.invites);
    setMyInvite(payload.myInvite);
  }, []);

  return {
    invites,
    setInvites,
    myInvite,
    setMyInvite,
    savingInvite,
    setSavingInvite,
    inviteEmail,
    setInviteEmail,
    inviteDisplayName,
    setInviteDisplayName,
    inviteOrganization,
    setInviteOrganization,
    inviteNote,
    setInviteNote,
    inviteRoles,
    setInviteRoles,
    inviteActionId,
    setInviteActionId,
    hydrateFromPayload,
  };
}

export type ContestInviteWorkspaceApi = ReturnType<
  typeof useContestInviteWorkspace
>;
