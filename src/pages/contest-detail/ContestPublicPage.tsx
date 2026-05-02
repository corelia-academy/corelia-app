import type { Dispatch, SetStateAction } from "react";
import type { ContestPublicSection } from "@/pages/contest-detail/types";
import ContestDetail from "@/pages/contest-detail/ContestDetail";
import type { Contest } from "@/types/contests";
import { useOutletContext, useParams } from "react-router";

export default function ContestPublicPage({ section }: { section: ContestPublicSection }) {
  const { contest, setContest } = useOutletContext<{
    contest: Contest | null;
    setContest: Dispatch<SetStateAction<Contest | null>>;
  }>();
  const { id } = useParams<{ id: string }>();
  if (!contest || !id || contest.id !== id) return null;
  return (
    <ContestDetail
      prefetchedContest={contest}
      publicSection={section}
      onContestSynced={setContest}
    />
  );
}
