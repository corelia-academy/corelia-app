import { useCallback, useState } from "react";
import type {
  ContestRegistration,
  ContestRegistrationStatus,
} from "@/types/hackathons";
import type { ContestDetailFetchedPayload } from "./fetchContestDetailPayload";

export function useContestRegistrationFlow() {
  const [registration, setRegistration] = useState<ContestRegistration | null>(
    null,
  );
  const [registrations, setRegistrations] = useState<ContestRegistration[]>(
    [],
  );
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);

  const [motivation, setMotivation] = useState("");
  const [applying, setApplying] = useState(false);

  const hydrateFromPayload = useCallback((payload: ContestDetailFetchedPayload) => {
    setReviewNotes(payload.reviewNotes);
    setRegistration(payload.registrationSelf);
    if (payload.clearRegistrationsForAggregateViewer) {
      setRegistrations([]);
    } else {
      setRegistrations(payload.registrations);
    }
  }, []);

  return {
    registration,
    setRegistration,
    registrations,
    setRegistrations,
    reviewNotes,
    setReviewNotes,
    savingReviewId,
    setSavingReviewId,
    motivation,
    setMotivation,
    applying,
    setApplying,
    hydrateFromPayload,
  };
}

export type ContestRegistrationFlowApi = ReturnType<
  typeof useContestRegistrationFlow
>;

export type RegistrationDecisionStatus = Extract<
  ContestRegistrationStatus,
  "approved" | "rejected"
>;
