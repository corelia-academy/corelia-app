import ContestDetail from "@/pages/hackathon-detail/ContestDetail";
import type { Contest } from "@/types/hackathons";
import { useOutletContext, useParams } from "react-router";

export default function ContestPublicPage() {
  const { contest, setContest } = useOutletContext<{
    contest: Contest | null;
    setContest: (next: Contest) => void;
  }>();
  const { slug } = useParams<{ slug: string }>();
  if (!contest || !slug || contest.slug !== slug) return null;
  return (
    <ContestDetail prefetchedContest={contest} onContestSynced={setContest} />
  );
}
