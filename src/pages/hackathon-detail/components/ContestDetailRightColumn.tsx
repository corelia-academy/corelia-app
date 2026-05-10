import { ContestDetailParticipantWorkspaceTabs } from "@/pages/hackathon-detail/components/ContestDetailParticipantWorkspaceTabs";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";

/** Public only: participant workspace rail. Manage settings live in the main column (`ContestDetailLeftColumn`). */
export function ContestDetailRightColumn() {
  const vm = useContestDetailVm();

  if (!vm.isManageView) {
    return <ContestDetailParticipantWorkspaceTabs vm={vm} />;
  }

  return null;
}
