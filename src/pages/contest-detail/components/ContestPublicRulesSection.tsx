import { Card, CardContent } from "@/components/ui/card";
import type { Contest } from "@/types/contests";
import { renderTextAsList } from "@/pages/contest-detail/utils/text";

export function ContestPublicRulesSection(props: {
  contest: Contest;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { contest, t } = props;

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-medium tracking-tight text-foreground">
          {t("detail.labels.rulesPublic")}
        </h2>
        {contest.rules?.trim()
          ? renderTextAsList(contest.rules)
          : renderTextAsList(t("detail.labels.rulesEmpty"))}
      </CardContent>
    </Card>
  );
}

