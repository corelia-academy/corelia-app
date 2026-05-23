import { HackathonSectionCard } from "@/pages/hackathon-detail/components/HackathonSectionCard";
import type { Contest } from "@/types/hackathons";
import { renderTextAsList } from "@/pages/hackathon-detail/utils/text";

export function ContestPublicRulesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;
  return (
    <HackathonSectionCard
      id="rules"
      title={t("detail.labels.rulesPublic")}
    >
      {contest.rules?.trim()
        ? renderTextAsList(contest.rules)
        : renderTextAsList(t("detail.labels.rulesEmpty"))}
    </HackathonSectionCard>
  );
}
