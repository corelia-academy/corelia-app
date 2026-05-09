import { ContestDetailManagerSettingsCard } from "@/pages/hackathon-detail/components/ContestDetailManagerSettingsCard";
import { ContestDetailParticipantApplicationCard } from "@/pages/hackathon-detail/components/ContestDetailParticipantApplicationCard";
import { ContestDetailParticipantSubmissionCard } from "@/pages/hackathon-detail/components/ContestDetailParticipantSubmissionCard";
import { ContestDetailSettingsInviteCard } from "@/pages/hackathon-detail/components/ContestDetailSettingsInviteCard";
import type { ContestDetailViewModel } from "@/pages/hackathon-detail/viewModel";

export function ContestDetailRightColumn({
  vm,
}: {
  vm: ContestDetailViewModel;
}) {
  const {
    isManageView,
    isManager,
    activeManageSection,
    myInvite,
    registration,
  } = vm;

  if (isManageView && isManager && activeManageSection === "settings") {
    return <ContestDetailManagerSettingsCard vm={vm} />;
  }

  if (isManageView && activeManageSection === "settings" && myInvite) {
    return <ContestDetailSettingsInviteCard vm={vm} />;
  }

  if (!isManageView && registration?.status === "approved") {
    return <ContestDetailParticipantSubmissionCard vm={vm} />;
  }

  if (!isManageView) {
    return <ContestDetailParticipantApplicationCard vm={vm} />;
  }

  return null;
}
