import { ContestDetailManageSectionTabs } from "@/pages/hackathon-detail/components/ContestDetailManageSectionTabs";
import { ContestDetailManagerSettingsCard } from "@/pages/hackathon-detail/components/ContestDetailManagerSettingsCard";
import { ContestDetailOverviewBlocks } from "@/pages/hackathon-detail/components/ContestDetailOverviewBlocks";
import { ContestDetailAwardsPanel } from "@/pages/hackathon-detail/components/ContestDetailAwardsPanel";
import { ContestDetailManageWorkspacePanels } from "@/pages/hackathon-detail/components/ContestDetailManageWorkspacePanels";
import { ContestDetailSettingsInviteCard } from "@/pages/hackathon-detail/components/ContestDetailSettingsInviteCard";
import { ContestDetailPublicFullSections } from "@/pages/hackathon-detail/components/ContestDetailPublicFullSections";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";
import { ContestPublicNav } from "@/pages/hackathon-detail/ContestPublicNav";

export function ContestDetailLeftColumn() {
  const vm = useContestDetailVm();

  if (vm.isManageView) {
    const settingsBody =
      vm.activeManageSection === "settings"
        ? vm.isManager
          ? <ContestDetailManagerSettingsCard vm={vm} />
          : vm.myInvite
            ? <ContestDetailSettingsInviteCard vm={vm} />
            : null
        : null;

    return (
      <div className="space-y-6 sm:space-y-8">
        <ContestDetailManageSectionTabs vm={vm} />
        <ContestDetailOverviewBlocks vm={vm} />
        <ContestDetailManageWorkspacePanels />
        {vm.isManager && vm.activeManageSection === "awards" ? (
          <ContestDetailAwardsPanel vm={vm} />
        ) : null}
        {settingsBody}
      </div>
    );
  }

  return (
    <>
      <ContestPublicNav />
      <div className="space-y-6 sm:space-y-8">
        <ContestDetailOverviewBlocks vm={vm} />
        <ContestDetailPublicFullSections />
      </div>
    </>
  );
}
