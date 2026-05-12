import { contestPublicShowcaseProjectsNavVisible } from "@/pages/hackathon-detail/utils/contestShowcase";
import { useContestDetailVm } from "@/pages/hackathon-detail/ContestDetailContext";
import { ContestPublicTimelineSection } from "@/pages/hackathon-detail/components/ContestPublicTimelineSection";
import { ContestPublicResourcesSection } from "@/pages/hackathon-detail/components/ContestPublicResourcesSection";
import { ContestPublicTrackSection } from "@/pages/hackathon-detail/components/ContestPublicTrackSection";
import { ContestPublicPrizesSection } from "@/pages/hackathon-detail/components/ContestPublicPrizesSection";
import { ContestPublicBadgesSection } from "@/pages/hackathon-detail/components/ContestPublicBadgesSection";
import { ContestPublicLearningSection } from "@/pages/hackathon-detail/components/ContestPublicLearningSection";
import { ContestPublicPeopleSection } from "@/pages/hackathon-detail/components/ContestPublicPeopleSection";
import { ContestPublicRulesSection } from "@/pages/hackathon-detail/components/ContestPublicRulesSection";
import { ContestPublicFaqsSection } from "@/pages/hackathon-detail/components/ContestPublicFaqsSection";
import { ContestPublicOrganizationalPartnersSection } from "@/pages/hackathon-detail/components/ContestPublicOrganizationalPartnersSection";
import { ContestPublicProjectsSection } from "@/pages/hackathon-detail/components/ContestPublicProjectsSection";
import { ContestPublicFinalCtaSection } from "@/pages/hackathon-detail/components/ContestPublicFinalCtaSection";
import { ContestDetailResultsBlocks } from "@/pages/hackathon-detail/components/ContestDetailResultsBlocks";

/** Single-page public hackathon: stacked sections with anchor ids for SubNav / hash links. */
export function ContestDetailPublicFullSections() {
  const vm = useContestDetailVm();
  const { contest, timelineRows, translate, formatDateTime } = vm;
  const milestonesCustom = (contest.timeline_milestones ?? []).length > 0;
  const showProjects = contestPublicShowcaseProjectsNavVisible(contest);

  return (
    <div className="space-y-6 sm:space-y-8">
      <ContestPublicResourcesSection contest={contest} t={translate} />
      <ContestPublicTimelineSection
        contest={contest}
        t={translate}
        milestonesCustom={milestonesCustom}
        timelineRows={timelineRows}
        formatDateTime={formatDateTime}
      />
      <ContestPublicTrackSection contest={contest} t={translate} />
      <ContestPublicPrizesSection contest={contest} t={translate} />
      <ContestPublicBadgesSection contest={contest} t={translate} />
      <ContestPublicLearningSection contest={contest} t={translate} />
      <ContestPublicPeopleSection contest={contest} t={translate} />
      <ContestPublicOrganizationalPartnersSection contest={contest} t={translate} />
      <ContestPublicRulesSection contest={contest} t={translate} />
      <ContestPublicFaqsSection contest={contest} t={translate} />
      <ContestDetailResultsBlocks vm={vm} />
      {showProjects ? <ContestPublicProjectsSection contest={contest} t={translate} /> : null}
      <ContestPublicFinalCtaSection />
    </div>
  );
}
