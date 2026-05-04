import { ContestDetailManagerSettingsCard } from "@/pages/contest-detail/components/ContestDetailManagerSettingsCard";
import { ContestDetailParticipantApplicationCard } from "@/pages/contest-detail/components/ContestDetailParticipantApplicationCard";
import { ContestDetailParticipantSubmissionCard } from "@/pages/contest-detail/components/ContestDetailParticipantSubmissionCard";
import { ContestDetailSettingsInviteCard } from "@/pages/contest-detail/components/ContestDetailSettingsInviteCard";
import type { ContestDetailViewModel } from "@/pages/contest-detail/viewModel";

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
