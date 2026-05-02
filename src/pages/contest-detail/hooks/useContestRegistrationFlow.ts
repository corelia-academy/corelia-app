import { useCallback, useMemo, useState } from "react";
import type {
  ContestRegistration,
  ContestRegistrationStatus,
} from "@/types/contests";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";
import { parseLineList } from "@/pages/contest-detail/utils/parse";

export function useContestRegistrationFlow() {
  const [registration, setRegistration] = useState<ContestRegistration | null>(
    null,
  );
  const [registrations, setRegistrations] = useState<ContestRegistration[]>(
    [],
  );
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamMembers, setTeamMembers] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [motivation, setMotivation] = useState("");
  const [applying, setApplying] = useState(false);

  const hydrateFromPayload = useCallback((payload: ContestDetailFetchedPayload) => {
    setReviewNotes(payload.reviewNotes);
    setRegistration(payload.registrationSelf);
    setTeamName(payload.teamName);
    setTeamMembers(payload.teamMembersText);
    if (payload.clearRegistrationsForAggregateViewer) {
      setRegistrations([]);
    } else {
      setRegistrations(payload.registrations);
    }
  }, []);

  const parsedTeamMembers = useMemo(
    () => parseLineList(teamMembers),
    [teamMembers],
  );

  return {
    registration,
    setRegistration,
    registrations,
    setRegistrations,
    reviewNotes,
    setReviewNotes,
    savingReviewId,
    setSavingReviewId,
    teamName,
    setTeamName,
    teamMembers,
    setTeamMembers,
    contactEmail,
    setContactEmail,
    contactPhone,
    setContactPhone,
    portfolioUrl,
    setPortfolioUrl,
    motivation,
    setMotivation,
    applying,
    setApplying,
    hydrateFromPayload,
    parsedTeamMembers,
  };
}

export type ContestRegistrationFlowApi = ReturnType<
  typeof useContestRegistrationFlow
>;

export type RegistrationDecisionStatus = Extract<
  ContestRegistrationStatus,
  "approved" | "rejected"
>;
