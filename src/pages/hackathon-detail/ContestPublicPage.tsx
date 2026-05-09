import type { Dispatch, SetStateAction } from "react";
import type { ContestPublicSection } from "@/pages/hackathon-detail/types";
import ContestDetail from "@/pages/hackathon-detail/ContestDetail";
import type { Contest } from "@/types/hackathons";
import { useOutletContext, useParams } from "react-router";

export default function ContestPublicPage({ section }: { section: ContestPublicSection }) {
  const { contest, setContest } = useOutletContext<{
    contest: Contest | null;
    setContest: Dispatch<SetStateAction<Contest | null>>;
  }>();
  const { slug } = useParams<{ slug: string }>();
  if (!contest || !slug || contest.slug !== slug) return null;
  return (
    <ContestDetail
      prefetchedContest={contest}
      publicSection={section}
      onContestSynced={setContest}
    />
  );
}
